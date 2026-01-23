#!/bin/bash

# Define common Chrome extension paths on macOS
COMMON_PATHS=(
    "$HOME/Library/Application Support/Google/Chrome/Default/Extensions"
    "$HOME/Library/Application Support/Google/Chrome/Profile 1/Extensions"
    "$HOME/Library/Application Support/Google/Chrome/Profile 2/Extensions"
    "$HOME/Library/Application Support/Google/Chrome Beta/Default/Extensions"
    "$HOME/Library/Application Support/Google/Chrome Canary/Default/Extensions"
    "$HOME/Library/Application Support/Chromium/Default/Extensions"
)

# Allow for a custom path - set this variable before running the script
# Example: CUSTOM_EXTENSION_PATH="/path/to/extensions" ./script.sh
CUSTOM_EXTENSION_PATH=${CUSTOM_EXTENSION_PATH:-""}

# Function to extract localized name from messages.json
extract_localized_name() {
    local version_dir="$1"
    local message_key="$2"
    
    # Remove "__MSG_" prefix and "__" suffix from the message key
    message_key=$(echo "$message_key" | sed -E 's/__MSG_(.*)__/\1/')
    
    # Look for message files, starting with en or en_US (preferred)
    local message_files=(
        "$version_dir/_locales/en/messages.json"
        "$version_dir/_locales/en_US/messages.json"
        $(find "$version_dir/_locales" -name "messages.json" | head -1)
    )
    
    # Try each message file until we find the key
    for message_file in "${message_files[@]}"; do
        if [ -f "$message_file" ]; then
            # Extract the message value for the key
            local name=$(grep -A 5 "\"$message_key\"" "$message_file" | grep -o '"message":[^,}]*' | head -1 | cut -d'"' -f4)
            if [ -n "$name" ]; then
                echo "$name"
                return 0
            fi
        fi
    done
    
    # If no localized name found, return the original message key with placeholders
    echo "[$message_key]"
}

# Function to extract extension information
get_extension_info() {
    local ext_path="$1"
    local ext_id="$2"
    local version_dir=""
    local manifest_path=""
    local name=""
    local version=""
    
    # Get the latest version directory
    version_dir=$(find "$ext_path/$ext_id" -maxdepth 1 -type d | sort -V | tail -1)
    
    if [ -n "$version_dir" ]; then
        manifest_path="$version_dir/manifest.json"
        
        if [ -f "$manifest_path" ]; then
            # Extract extension name and version using grep
            raw_name=$(grep -o '"name":[^,}]*' "$manifest_path" | head -1 | sed 's/"name"://; s/^[ \t]*"//; s/"[ \t]*$//')
            version=$(grep -o '"version":[^,}]*' "$manifest_path" | head -1 | sed 's/"version"://; s/^[ \t]*"//; s/"[ \t]*$//')
            
            # Check if name is localized (contains __MSG_ pattern)
            if [[ "$raw_name" == *__MSG_* ]]; then
                name=$(extract_localized_name "$version_dir" "$raw_name")
            else
                name="$raw_name"
            fi
            
            # Special handling for default extension
            if [ "$ext_id" = "nmmhkkegccagdldgiimedpiccmgmieda" ]; then
                name="Google Wallet (default extension)"
            fi
            
            # Output extension information
            echo "ID: $ext_id"
            echo "Name: ${name:-Unknown Extension}"
            echo "Version: ${version:-Unknown}"
            echo "Path: $version_dir"
            echo "----------------------------------------"
        fi
    fi
}

# Function to list extensions
list_extensions() {
    local chrome_path="$1"
    
    if [ -d "$chrome_path" ]; then
        echo "Extensions found in: $chrome_path"
        echo "----------------------------------------"
        
        for ext_id in $(ls "$chrome_path"); do
            if [ -d "$chrome_path/$ext_id" ]; then
                get_extension_info "$chrome_path" "$ext_id"
            fi
        done
        echo ""
    fi
}

# Process common paths
for path in "${COMMON_PATHS[@]}"; do
    if [ -d "$path" ]; then
        list_extensions "$path"
    fi
done

# Process custom path if set
if [ -n "$CUSTOM_EXTENSION_PATH" ] && [ -d "$CUSTOM_EXTENSION_PATH" ]; then
    list_extensions "$CUSTOM_EXTENSION_PATH"
fi

exit 0
