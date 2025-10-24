CC = gcc
CFLAGS = -Wall -Wextra -Werror -std=c11 -I../main -pthread
LDFLAGS = -pthread

TARGETS = test_http_client_utils test_deadman_timer

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

run: $(TARGETS)
	./test_http_client_utils
	./test_deadman_timer

clean:
	rm -f $(TARGETS) *.o deadman_timer_test_support.o http_client_utils_test_support.o
