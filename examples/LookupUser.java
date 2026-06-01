import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * 飞书用户查询 — 根据手机号查用户信息。
 *
 * 编译: javac LookupUser.java
 * 运行: FEISHU_API_KEY=<key> FEISHU_PHONE=13800000000 java LookupUser
 */
public class LookupUser {

    private static final String BASE_URL = "http://8.130.149.29:3000";
    private static final String API_KEY  = System.getenv().getOrDefault("FEISHU_API_KEY", "your-api-key");
    private static final String PHONE    = System.getenv().getOrDefault("FEISHU_PHONE", "13800000000");

    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        // 构造请求体: { "command": "user.search-by-phone", "params": { "phone": "17778115261" } }
        String body = """
                {
                    "command": "user.search-by-phone",
                    "params": { "phone": "%s" }
                }
                """.formatted(PHONE);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/api/v1/exec"))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + API_KEY)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        System.out.println(">>> 查询手机号: " + PHONE);
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println("HTTP " + response.statusCode());
        System.out.println(response.body());
    }
}
