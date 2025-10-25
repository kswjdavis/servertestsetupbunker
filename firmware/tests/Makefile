CC = gcc
CFLAGS = -Wall -Wextra -Werror -std=c11 -I../main -pthread
LDFLAGS = -pthread

TARGETS = test_http_client_utils test_deadman_timer test_relay_controller test_control_loop_logic test_auth_fail_safe

.PHONY: all clean run

all: $(TARGETS)

test_http_client_utils: test_http_client_utils.o http_client_utils_test_support.o
	$(CC) $(CFLAGS) $^ -o $@ $(LDFLAGS)

test_http_client_utils.o: test_http_client_utils.c
	$(CC) $(CFLAGS) -c $< -o $@

http_client_utils_test_support.o: ../main/http_client_utils.c
	$(CC) $(CFLAGS) -c $< -o $@

test_deadman_timer: test_deadman_timer.o deadman_timer_test_support.o
	$(CC) $(CFLAGS) $^ -o $@ $(LDFLAGS)

test_deadman_timer.o: test_deadman_timer.c
	$(CC) $(CFLAGS) -DUNIT_TEST -c $< -o $@

deadman_timer_test_support.o: ../main/deadman_timer.c
	$(CC) $(CFLAGS) -DUNIT_TEST -c $< -o $@

test_relay_controller: test_relay_controller.o relay_controller_test_support.o
	$(CC) $(CFLAGS) $^ -o $@ $(LDFLAGS)

test_relay_controller.o: test_relay_controller.c
	$(CC) $(CFLAGS) -DUNIT_TEST -c $< -o $@

relay_controller_test_support.o: ../main/relay_controller.c
	$(CC) $(CFLAGS) -DUNIT_TEST -c $< -o $@

test_auth_fail_safe: test_auth_fail_safe.o auth_fail_safe_test_support.o
	$(CC) $(CFLAGS) $^ -o $@ $(LDFLAGS)

test_auth_fail_safe.o: test_auth_fail_safe.c
	$(CC) $(CFLAGS) -DUNIT_TEST -c $< -o $@

auth_fail_safe_test_support.o: ../main/auth_fail_safe.c
	$(CC) $(CFLAGS) -DUNIT_TEST -c $< -o $@

test_control_loop_logic: test_control_loop_logic.o control_loop_logic.o
	$(CC) $(CFLAGS) $^ -o $@ $(LDFLAGS)

test_control_loop_logic.o: test_control_loop_logic.c
	$(CC) $(CFLAGS) -c $< -o $@

control_loop_logic.o: ../main/control_loop_logic.c
	$(CC) $(CFLAGS) -c $< -o $@

run: $(TARGETS)
	./test_http_client_utils
	./test_deadman_timer
	./test_relay_controller
	./test_control_loop_logic
	./test_auth_fail_safe

clean:
	rm -f $(TARGETS) *.o \
		deadman_timer_test_support.o \
		http_client_utils_test_support.o \
		relay_controller_test_support.o \
		control_loop_logic.o \
		auth_fail_safe_test_support.o
