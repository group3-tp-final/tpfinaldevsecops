# --- Build stage ---
FROM golang:1.21-alpine AS build

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o server main.go

# --- Run stage ---
FROM alpine:3.19

WORKDIR /app

COPY --from=build /app/server .

EXPOSE 3000

CMD ["./server"]