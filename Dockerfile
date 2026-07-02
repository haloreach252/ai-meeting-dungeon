FROM nginx:1.27-alpine

# Static site only: the harness plus both variant builds live under web/.
COPY web/ /usr/share/nginx/html/

EXPOSE 80
