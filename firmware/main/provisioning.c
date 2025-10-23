#include "provisioning.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#include "esp_event.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"

static const char *TAG = "provisioning";

#define PROV_EVENT_COMPLETE BIT0
#define PROV_HTTP_BODY_MAX_LEN 512
#define PROV_TIMEOUT_MS (5 * 60 * 1000)  // 5 minutes timeout

static EventGroupHandle_t s_event_group;
static provisioning_result_t *s_result;
static httpd_handle_t s_httpd;
static esp_netif_t *s_ap_netif;

static void url_decode(char *dest, size_t dest_len, const char *src)
{
    if (dest == NULL || src == NULL || dest_len == 0) {
        return;
    }

    size_t di = 0;
    for (size_t i = 0; src[i] != '\0' && di + 1 < dest_len; ++i) {
        if (src[i] == '%' && src[i + 1] != '\0' && src[i + 2] != '\0' &&
            isxdigit((unsigned char)src[i + 1]) && isxdigit((unsigned char)src[i + 2])) {
            char hex[3] = {src[i + 1], src[i + 2], '\0'};
            dest[di++] = (char)strtol(hex, NULL, 16);
            i += 2;
        } else if (src[i] == '+') {
            dest[di++] = ' ';
        } else {
            dest[di++] = src[i];
        }
    }
    dest[di] = '\0';
}

static esp_err_t parse_form_payload(char *payload, provisioning_result_t *result)
{
    if (payload == NULL || result == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    char *context = NULL;
    char *token = strtok_r(payload, "&", &context);
    bool ssid_set = false;
    bool password_set = false;

    result->has_auth_token = false;
    result->ssid[0] = '\0';
    result->password[0] = '\0';
    result->auth_token[0] = '\0';

    while (token != NULL) {
        char *equals = strchr(token, '=');
        if (equals != NULL) {
            *equals = '\0';
            const char *key = token;
            const char *value = equals + 1;
            char decoded[STORAGE_AUTH_TOKEN_MAX_LEN + 1];
            url_decode(decoded, sizeof(decoded), value);

            if (strcmp(key, "ssid") == 0) {
                strlcpy(result->ssid, decoded, sizeof(result->ssid));
                ssid_set = true;
            } else if (strcmp(key, "password") == 0) {
                strlcpy(result->password, decoded, sizeof(result->password));
                password_set = true;
            } else if (strcmp(key, "token") == 0) {
                strlcpy(result->auth_token, decoded, sizeof(result->auth_token));
                result->has_auth_token = (result->auth_token[0] != '\0');
            }
        }
        token = strtok_r(NULL, "&", &context);
    }

    if (!ssid_set || !password_set) {
        return ESP_ERR_INVALID_ARG;
    }

    return ESP_OK;
}

static esp_err_t provisioning_get_handler(httpd_req_t *req)
{
    static const char kPage[] =
        "<!doctype html><html><head><title>BunkerColab Provisioning</title></head>"
        "<body><h1>Provision WiFi</h1>"
        "<form method=\"POST\">"
        "SSID: <input name=\"ssid\" maxlength=\"32\" required><br>"
        "Password: <input name=\"password\" maxlength=\"64\" type=\"password\" required><br>"
        "Device Token (optional): <input name=\"token\" maxlength=\"128\"><br>"
        "<button type=\"submit\">Save</button>"
        "</form></body></html>";

    httpd_resp_set_type(req, "text/html");
    return httpd_resp_send(req, kPage, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t provisioning_post_handler(httpd_req_t *req)
{
    if (req->content_len >= PROV_HTTP_BODY_MAX_LEN) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Payload too large");
        return ESP_FAIL;
    }

    char buf[PROV_HTTP_BODY_MAX_LEN] = {0};
    int received = 0;
    while (received < req->content_len) {
        int chunk = httpd_req_recv(req, buf + received, req->content_len - received);
        if (chunk <= 0) {
            if (chunk == HTTPD_SOCK_ERR_TIMEOUT) {
                continue;
            }
            httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Failed to receive payload");
            return ESP_FAIL;
        }
        received += chunk;
    }
    buf[received] = '\0';

    provisioning_result_t temp;
    esp_err_t err = parse_form_payload(buf, &temp);
    if (err != ESP_OK) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Missing required fields");
        return err;
    }

    *s_result = temp;
    httpd_resp_sendstr(req, "Provisioning successful. Device will restart.\n");

    xEventGroupSetBits(s_event_group, PROV_EVENT_COMPLETE);
    return ESP_OK;
}

static esp_err_t start_http_server(void)
{
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.recv_wait_timeout = 5;
    config.send_wait_timeout = 5;

    esp_err_t err = httpd_start(&s_httpd, &config);
    if (err != ESP_OK) {
        return err;
    }

    httpd_uri_t root_get = {
        .uri = "/",
        .method = HTTP_GET,
        .handler = provisioning_get_handler,
    };
    httpd_register_uri_handler(s_httpd, &root_get);

    httpd_uri_t root_post = {
        .uri = "/",
        .method = HTTP_POST,
        .handler = provisioning_post_handler,
    };
    httpd_register_uri_handler(s_httpd, &root_post);
    return ESP_OK;
}

static void stop_http_server(void)
{
    if (s_httpd != NULL) {
        httpd_stop(s_httpd);
        s_httpd = NULL;
    }
}

static void configure_softap(const uint8_t mac[6], wifi_config_t *ap_config)
{
    memset(ap_config, 0, sizeof(*ap_config));
    snprintf((char *)ap_config->ap.ssid,
             sizeof(ap_config->ap.ssid),
             "BunkerColab-%02X%02X%02X",
             mac[3],
             mac[4],
             mac[5]);
    ap_config->ap.channel = 1;
    ap_config->ap.max_connection = 4;
    ap_config->ap.authmode = WIFI_AUTH_OPEN;
    ap_config->ap.ssid_len = strlen((const char *)ap_config->ap.ssid);
}

esp_err_t provisioning_run(const uint8_t mac_bytes[6], provisioning_result_t *result)
{
    if (mac_bytes == NULL || result == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    if (s_event_group != NULL) {
        return ESP_ERR_INVALID_STATE;
    }
    s_event_group = xEventGroupCreate();
    if (s_event_group == NULL) {
        return ESP_ERR_NO_MEM;
    }
    s_result = result;

    if (s_ap_netif == NULL) {
        s_ap_netif = esp_netif_create_default_wifi_ap();
    }

    esp_err_t err = esp_wifi_stop();
    if (err != ESP_OK && err != ESP_ERR_WIFI_NOT_INIT && err != ESP_ERR_WIFI_NOT_STARTED) {
        ESP_LOGE(TAG, "Failed to stop WiFi prior to provisioning: %s", esp_err_to_name(err));
        vEventGroupDelete(s_event_group);
        s_event_group = NULL;
        return err;
    }

    wifi_config_t ap_config;
    configure_softap(mac_bytes, &ap_config);

    ESP_LOGI(TAG, "Starting provisioning AP with SSID '%s'", ap_config.ap.ssid);
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    err = start_http_server();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start provisioning HTTP server: %s", esp_err_to_name(err));
        esp_wifi_stop();
        vEventGroupDelete(s_event_group);
        s_event_group = NULL;
        return err;
    }

    EventBits_t bits = xEventGroupWaitBits(
        s_event_group,
        PROV_EVENT_COMPLETE,
        pdTRUE,
        pdFALSE,
        pdMS_TO_TICKS(PROV_TIMEOUT_MS));

    stop_http_server();
    esp_wifi_stop();

    vEventGroupDelete(s_event_group);
    s_event_group = NULL;
    s_result = NULL;

    if ((bits & PROV_EVENT_COMPLETE) == 0) {
        ESP_LOGW(TAG, "Provisioning timed out after %d ms", PROV_TIMEOUT_MS);
        return ESP_ERR_TIMEOUT;
    }

    ESP_LOGI(TAG, "Provisioning complete. Credentials captured.");
    return ESP_OK;
}
