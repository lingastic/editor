BASE_DIR=`dirname "$0"`
# so nodemon will restart on change
cd ${BASE_DIR}
/usr/bin/env npx nodemon index.ts
