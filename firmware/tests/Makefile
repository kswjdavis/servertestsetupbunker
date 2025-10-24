CC = gcc
CFLAGS = -Wall -Wextra -Werror -std=c11 -I../main
LDFLAGS =

SRCS = test_http_client_utils.c ../main/http_client_utils.c
OBJS = $(SRCS:.c=.o)
TARGET = test_http_client_utils

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) $(OBJS) -o $(TARGET) $(LDFLAGS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

run: $(TARGET)
	./$(TARGET)

clean:
	rm -f $(OBJS) $(TARGET)
