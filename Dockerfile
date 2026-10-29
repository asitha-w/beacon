FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /beacon ./cmd/beacon

FROM gcr.io/distroless/static-debian12
COPY --from=build /beacon /beacon
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/beacon"]
