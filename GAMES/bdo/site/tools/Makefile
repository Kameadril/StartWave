CC := xcrun clang
CFLAGS := -std=c11 -fobjc-arc -Wall -Wextra -Werror -O2 -mmacosx-version-min=11.0
FRAMEWORKS := -framework Foundation -framework Security
SOURCE := bdo-owner-materializer.m
OUTPUT ?= bdo-owner-materializer

.PHONY: all clean
all: $(OUTPUT)

$(OUTPUT): $(SOURCE)
	@mkdir -p "$(dir $(OUTPUT))"
	$(CC) $(CFLAGS) $(FRAMEWORKS) $< -o "$@"

clean:
	rm -f "$(OUTPUT)"
