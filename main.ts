// main.ts - 反向代理到中文Wikipedia，加上登录页面和重定向，使用环境变量
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const usersEnv = Deno.env.get("USERS");
const USERS = usersEnv ? JSON.parse(usersEnv) : {};  // 解析成对象，如果没设，就空对象

const TARGET_URL = "https://zh.wikipedia.org";  // 目标URL改为中文Wikipedia

// 从环境变量读取背景图片和头像图片的URL，设置默认值以防环境变量未定义
const avatarUrl = Deno.env.get("AVATAR_URL") || "https://img20.360buyimg.com/openfeedback/jfs/t1/279469/38/22471/35268/680119eaF30689ef9/60cf60dd81ba15b5.png";
const backgroundUrl = Deno.env.get("Background_URL") || "https://img20.360buyimg.com/openfeedback/jfs/t1/279469/38/22471/35268/680119eaF30689ef9/60cf60dd81ba15b5.png";

async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/login") {
        if (req.method === "GET") {
            const goto = url.searchParams.get("goto") || "/";
            return new Response(`
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login to Wikipedia Proxy</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f3f4f6;  /* 轻灰背景作为默认 */
                ${backgroundUrl ? `background-image: url('${backgroundUrl}');` : ''}  /* 使用环境变量设置背景图片，如果有的话 */
                background-size: cover;  /* 让图片覆盖整个背景 */
                background-position: center;  /* 居中对齐 */
                background-repeat: no-repeat;  /* 不重复 */
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }
            .login-container {
                background: rgba(255, 255, 255, 0.9);  /* 半透明背景，防止背景图片干扰文字 */
                padding: 2rem;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);  /* 阴影效果 */
                width: 300px;
                text-align: center;
            }
            .avatar {
                width: 100px;
                height: 100px;
                border-radius: 50%;  /* 圆形头像 */
                margin-bottom: 1rem;
            }
            h1 {
                color: #1a202c;  /* 深灰标题 */
                font-size: 1.5rem;
                margin-bottom: 1rem;
            }
            input[type="text"], input[type="password"] {
                width: 100%;
                padding: 0.5rem;
                margin: 0.5rem 0;
                border: 1px solid #cbd5e0;  /* 边框像输入框 */
                border-radius: 4px;
            }
            button {
                width: 100%;
                padding: 0.75rem;
                background-color: #4299e1;  /* 蓝按钮 */
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 1rem;
            }
            button:hover {
                background-color: #2b6cb0;  /* hover效果 */
            }
        </style>
        <script>
            // 读取URL参数中的bg，动态覆盖背景图片
            const urlParams = new URLSearchParams(window.location.search);
            const bgUrl = urlParams.get('bg');
            if (bgUrl) {
                document.body.style.backgroundImage = \`url(\${encodeURI(bgUrl)})\`;
                document.body.style.backgroundColor = 'transparent';  // 如果有背景图片，覆盖默认颜色
            }
        </script>
    </head>
    <body>
        <div class="login-container">
            <img src="${avatarUrl}" alt="Wikipedia Logo" class="avatar">  <!-- 使用环境变量设置头像图片 -->
            <h1>登录Wikipedia代理</h1>
            <form method="POST" action="/login?goto=${encodeURIComponent(goto)}">
                <label for="username">用户名：</label><br>
                <input type="text" id="username" name="username" required><br>
                <label for="password">密码：</label><br>
                <input type="password" id="password" name="password" required><br>
                <button type="submit">登录</button>
                <p>Power by deno.land & jxufe.icu</p>
            </form>
        </div>
    </body>
</html>
            `, {
                status: 200,
                headers: { "Content-Type": "text/html; charset=UTF-8" }
            });
        } else if (req.method === "POST") {
            const formData = await req.formData();
            const username = formData.get("username")?.toString() || "";
            const password = formData.get("password")?.toString() || "";
            const goto = url.searchParams.get("goto") || "/";

            if (USERS[username] === password) {  // 用从环境变量得来的USERS检查
                const headers = new Headers();
                headers.set("Set-Cookie", `session=authenticated; Path=/; HttpOnly; Max-Age=3600`);
                headers.set("Location", goto);
                return new Response("Logged in. Redirecting...", { status: 302, headers });
            } else {
                return new Response("Login failed, wrong credentials, shithead.", { status: 401 });
            }
        }
    }

    // 对于其他路径，先检查Cookie认证
    const sessionCookie = req.headers.get("Cookie")?.includes("session=authenticated");
    if (!sessionCookie) {
        const headers = new Headers();
        headers.set("Location", "/login?goto=" + encodeURIComponent(url.pathname + url.search));
        return new Response("Not logged in, redirecting to login.", {
            status: 302,
            headers: headers
        });
    }

    try {
        const targetPath = url.pathname + url.search;
        const fullTargetUrl = `${TARGET_URL}${targetPath}`;

        const proxyReq = new Request(fullTargetUrl, {
            method: req.method,
            headers: req.headers,
            body: req.body,
            redirect: "follow",
        });

        const response = await fetch(proxyReq);
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    } catch (error) {
        console.error("Fuck, error in proxy:", error.message);
        return new Response(`Something went wrong. Error: ${error.message}. Check logs.`, { status: 500 });
    }
}

// 启动服务器
serve(handler, { port: 8080 });
console.log("Reverse proxy with login via env vars running on http://localhost:8080. Set your USERS env var, you bastard!");
