docker stop xlabrouter
docker rm xlabrouter
docker build -t xlabrouter .
docker run -d --name xlabrouter -p 1212:1212 --env-file .env -e JWT_SECRET="${JWT_SECRET:-change-me}" -e INITIAL_PASSWORD="${INITIAL_PASSWORD:-change-me}" -e DATA_DIR=/var/lib/xlabrouter -v xlabrouter-data:/var/lib/xlabrouter xlabrouter