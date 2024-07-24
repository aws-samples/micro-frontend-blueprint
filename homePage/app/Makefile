TARGET_DIR = .next/standalone
TARGET_FILE = $(TARGET_DIR)/run.sh

install:
	rm -rf node_modules
	npm install

build:
	npm run build

create_handler:
	echo "#!/bin/bash" > $(TARGET_FILE)
	echo "exec node server.js" >> $(TARGET_FILE)

build-mfe: install build create_handler

