CC := xcrun clang
CFLAGS := -std=c11 -fobjc-arc -Wall -Wextra -Werror -O2 -mmacosx-version-min=11.0
FRAMEWORKS := -framework Foundation -framework Security
TARGET := bdo-owner-materializer

.PHONY: all clean
all: $(TARGET)

$(TARGET): bdo-owner-materializer.m
	$(CC) $(CFLAGS) $(FRAMEWORKS) $< -o $@

clean:
	rm -f $(TARGET)
