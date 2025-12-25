#!/bin/bash

cd "$(dirname "$0")"

# Crash loop detection settings
MAX_CRASHES=5
CRASH_WINDOW=60  # seconds
declare -a CRASH_TIMES=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get timestamp
get_timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Check if we're in a crash loop
is_crash_loop() {
    local now=$(date +%s)
    local count=0
    local new_times=()

    # Filter crashes within the window
    for crash_time in "${CRASH_TIMES[@]}"; do
        if (( now - crash_time <= CRASH_WINDOW )); then
            new_times+=("$crash_time")
            ((count++))
        fi
    done

    # Update crash times array
    CRASH_TIMES=("${new_times[@]}")

    # Return true if too many crashes
    if (( count >= MAX_CRASHES )); then
        return 0  # true in bash
    fi

    return 1  # false in bash
}

# Record a crash
record_crash() {
    CRASH_TIMES+=("$(date +%s)")
}

# Clear crash history
clear_crash_history() {
    CRASH_TIMES=()
}

while true; do
    echo ""
    echo "[$(get_timestamp)] ${GREEN}Starting Galaxy Discord Bot...${NC}"
    echo "================================================"

    node index.js
    EXIT_CODE=$?

    # Calculate runtime
    END_TIME=$(date +%s)
    RUNTIME=$((END_TIME - START_TIME))

    echo ""
    echo "================================================"
    echo -e "[$(get_timestamp)] Bot exited (code: ${EXIT_CODE}, runtime: ${RUNTIME} seconds)"

    # Handle exit codes
    if [ $EXIT_CODE -eq 0 ]; then
        # Exit code 0 = intentional restart
        echo "[$(get_timestamp)] Restart requested. Restarting in 2 seconds..."
        clear_crash_history
        sleep 2
        continue
    elif [ $EXIT_CODE -eq 1 ]; then
        # Exit code 1 = clean shutdown
        echo "[$(get_timestamp)] Clean shutdown. Goodbye!"
        exit 0
    else
        # Other codes = crash
        record_crash

        # Check for crash loop
        if is_crash_loop; then
            echo ""
            echo "================================================"
            echo -e "  *** ${RED}CRASH LOOP DETECTED - STOPPING BOT${NC} ***   "
            echo "================================================"
            echo -e "${RED} ${#CRASH_TIMES[@]} crashes detected"
            echo "Please check the logs and fix the issue."
            echo "================================================="
            echo ""
            exit 1
        fi

        # Calculate remaining attempts
        REMAINING=$((MAX_CRASHES - ${#CRASH_TIMES[@]}))

        echo -e "[$(get_timestamp)] ${YELLOW}Crash detected!${NC} Restarting in 5 seconds..."
        echo -e "[$(get_timestamp)] Remaining restart attempts: ${REMAINING}/${MAX_CRASHES}"
        sleep 5
    fi
done