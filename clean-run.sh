# rm -Rf .quartz-cache
# rm -Rf quartz/.quartz-cache

rm -Rf public
npx quartz build --serve --port 1231 --concurrency 4
