echo -e "cleanup"
rm -Rf .quartz-cache
rm -Rf quartz/.quartz-cache

rm -Rf public

echo -e "linkt"
./lint.sh

echo -e "change-text"
./change-text.sh

echo -e "buliding quartz"

npx quartz build --serve --port 1231 --concurrency 8
