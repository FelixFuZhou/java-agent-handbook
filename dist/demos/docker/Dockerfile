FROM eclipse-temurin:17-jre
WORKDIR /app
COPY target/classes/ /app/classes/
USER 10001:10001
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=60", "-cp", "/app/classes", "demo.ConnectDemo"]
