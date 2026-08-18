/*
 * ============================================================
 * GitHub Star Release Monitor - Loon
 * ============================================================
 *
 * 文件：
 * github_star_release_monitor_loon.js
 *
 * 功能：
 * 1. 自动获取当前 GitHub 账号全部 Star 仓库
 * 2. 自动分页
 * 3. 检查每个仓库最新 Release
 * 4. 每小时检查一次
 * 5. 首次运行只建立基准，不发送通知
 * 6. 新 Release 自动发送 Loon 系统通知
 * 7. 点击通知打开 GitHub Release
 * 8. 默认忽略 Pre-release
 * 9. 自动保存历史版本
 *
 * Loon 专用
 * ============================================================
 */

const CONFIG = {

    // ========================================================
    // GitHub Token
    // ========================================================
    //
    // 请在这里填写你重新生成的 GitHub Token。
    //
    // 权限：
    // Account permissions
    //     Starring -> Read-only
    //
    GITHUB_TOKEN: "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",


    // ========================================================
    // GitHub API
    // ========================================================

    API_BASE: "https://api.github.com",

    API_VERSION: "2026-03-10",

    PER_PAGE: 100,


    // ========================================================
    // Release 设置
    // ========================================================

    // false = 只监控正式 Release
    // true  = 同时监控 Beta / RC / Alpha
    INCLUDE_PRERELEASE: false,


    // ========================================================
    // 通知设置
    // ========================================================

    ENABLE_NOTIFY: true,

    NOTIFY_TITLE: "GitHub Star 更新",

    // 一次最多发送多少条独立通知
    MAX_NOTIFY_COUNT: 10,

    // 超过通知上限时发送汇总通知
    ENABLE_SUMMARY_NOTIFY: true,


    // ========================================================
    // 调试
    // ========================================================

    DEBUG: false,


    // ========================================================
    // Loon Persistent Storage
    // ========================================================

    STORAGE_KEY:
        "github_star_release_monitor_loon_v1",

    // 第一次运行是否通知初始化完成
    NOTIFY_INITIALIZED: false
};


// ============================================================
// 日志
// ============================================================

function log(message) {

    if (CONFIG.DEBUG) {

        console.log(
            "[GitHub Star Loon] " +
            message
        );
    }
}


// ============================================================
// 延迟
// ============================================================

function sleep(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}


// ============================================================
// Persistent Storage
// ============================================================

function loadState() {

    try {

        const value =
            $persistentStore.read(
                CONFIG.STORAGE_KEY
            );


        if (!value) {

            return null;
        }


        return JSON.parse(value);

    } catch (error) {

        log(
            "读取历史数据失败：" +
            error
        );

        return null;
    }
}


function saveState(state) {

    try {

        return $persistentStore.write(
            JSON.stringify(state),
            CONFIG.STORAGE_KEY
        );

    } catch (error) {

        log(
            "保存历史数据失败：" +
            error
        );

        return false;
    }
}


// ============================================================
// GitHub HTTP GET
// ============================================================

function githubRequest(url) {

    return new Promise(
        (resolve, reject) => {

            const headers = {

                "Accept":
                    "application/vnd.github+json",

                "X-GitHub-Api-Version":
                    CONFIG.API_VERSION,

                "User-Agent":
                    "Loon-GitHub-Star-Release-Monitor"
            };


            /*
             * Token
             */

            if (
                CONFIG.GITHUB_TOKEN &&
                CONFIG.GITHUB_TOKEN.indexOf(
                    "在这里填写"
                ) === -1
            ) {

                headers["Authorization"] =
                    "Bearer " +
                    CONFIG.GITHUB_TOKEN;
            }


            const options = {

                url: url,

                headers: headers,

                timeout: 20
            };


            $httpClient.get(
                options,

                (error, response, body) => {

                    if (error) {

                        reject(
                            new Error(
                                String(error)
                            )
                        );

                        return;
                    }


                    const status =
                        response &&
                        response.status;


                    log(
                        "HTTP " +
                        status +
                        " <- " +
                        url
                    );


                    if (
                        status >= 200 &&
                        status < 300
                    ) {

                        try {

                            resolve(
                                JSON.parse(body)
                            );

                        } catch (parseError) {

                            reject(
                                new Error(
                                    "JSON 解析失败：" +
                                    parseError
                                )
                            );
                        }


                        return;
                    }


                    reject(
                        new Error(
                            "HTTP " +
                            status +
                            ": " +
                            body
                        )
                    );
                }
            );
        }
    );
}


// ============================================================
// 获取全部 Star
// ============================================================

async function getAllStarredRepositories() {

    const repositories = [];

    let page = 1;


    while (true) {

        const url =
            CONFIG.API_BASE +
            "/user/starred" +
            "?per_page=" +
            CONFIG.PER_PAGE +
            "&page=" +
            page;


        log(
            "读取 Star 第 " +
            page +
            " 页"
        );


        const data =
            await githubRequest(url);


        if (
            !Array.isArray(data)
        ) {

            throw new Error(
                "GitHub Star API 返回数据异常"
            );
        }


        if (
            data.length === 0
        ) {

            break;
        }


        repositories.push(
            ...data
        );


        /*
         * 最后一页
         */

        if (
            data.length <
            CONFIG.PER_PAGE
        ) {

            break;
        }


        page++;


        /*
         * 安全上限
         */

        if (page > 1000) {

            throw new Error(
                "Star 分页超过安全上限"
            );
        }


        await sleep(200);
    }


    return repositories;
}


// ============================================================
// 获取最新 Release
// ============================================================

async function getLatestRelease(fullName) {

    const url =
        CONFIG.API_BASE +
        "/repos/" +
        fullName +
        "/releases/latest";


    try {

        return await githubRequest(url);

    } catch (error) {

        const text =
            String(error);


        /*
         * 404：
         * 仓库没有 Release
         */

        if (
            text.indexOf("HTTP 404") !== -1
        ) {

            return null;
        }


        log(
            "Release 获取失败：" +
            fullName +
            " / " +
            text
        );


        return null;
    }
}


// ============================================================
// 判断是否监控
// ============================================================

function shouldMonitorRelease(release) {

    if (!release) {

        return false;
    }


    /*
     * Draft
     */

    if (
        release.draft === true
    ) {

        return false;
    }


    /*
     * Pre-release
     */

    if (
        release.prerelease === true &&
        !CONFIG.INCLUDE_PRERELEASE
    ) {

        return false;
    }


    return true;
}


// ============================================================
// 格式化时间
// ============================================================

function formatDate(dateString) {

    if (!dateString) {

        return "";
    }


    const date =
        new Date(dateString);


    if (
        isNaN(
            date.getTime()
        )
    ) {

        return dateString;
    }


    /*
     * 使用设备本地时间
     */

    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    const hour =
        String(
            date.getHours()
        ).padStart(2, "0");


    const minute =
        String(
            date.getMinutes()
        ).padStart(2, "0");


    return (
        year +
        "-" +
        month +
        "-" +
        day +
        " " +
        hour +
        ":" +
        minute
    );
}


// ============================================================
// Release 名称
// ============================================================

function getReleaseName(release) {

    return (
        release.tag_name ||
        release.name ||
        "新版本"
    );
}


// ============================================================
// Loon 通知
// ============================================================

function notifyRelease(release) {

    if (
        !CONFIG.ENABLE_NOTIFY
    ) {

        return;
    }


    const fullName =
        release.full_name ||
        "GitHub Repository";


    const version =
        getReleaseName(
            release
        );


    const published =
        formatDate(
            release.published_at
        );


    let message =
        "版本：" +
        version;


    if (published) {

        message +=
            "\n发布时间：" +
            published;
    }


    if (
        release.prerelease
    ) {

        message +=
            "\n类型：Pre-release";
    }


    /*
     * Loon：
     *
     * $notification.post(
     *     title,
     *     subtitle,
     *     body,
     *     openUrl
     * )
     */

    $notification.post(

        CONFIG.NOTIFY_TITLE,

        fullName +
        " 发布新版本",

        message,

        release.html_url
    );
}


// ============================================================
// 汇总通知
// ============================================================

function notifySummary(releases) {

    if (
        !CONFIG.ENABLE_NOTIFY ||
        !CONFIG.ENABLE_SUMMARY_NOTIFY
    ) {

        return;
    }


    if (
        releases.length <=
        CONFIG.MAX_NOTIFY_COUNT
    ) {

        return;
    }


    const hidden =
        releases.length -
        CONFIG.MAX_NOTIFY_COUNT;


    $notification.post(

        "GitHub Star 更新",

        "检测到多个新 Release",

        "本次共发现 " +
        releases.length +
        " 个新版本，已通知前 " +
        CONFIG.MAX_NOTIFY_COUNT +
        " 个，另外 " +
        hidden +
        " 个未单独推送。"
    );
}


// ============================================================
// 主程序
// ============================================================

async function main() {

    log(
        "========== 开始检查 =========="
    );


    /*
     * --------------------------------------------------------
     * 读取历史状态
     * --------------------------------------------------------
     */

    let state =
        loadState();


    const firstRun =
        !state;


    if (!state) {

        state = {

            version: 1,

            initialized: false,

            lastCheck: null,

            releases: {}
        };
    }


    if (!state.releases) {

        state.releases = {};
    }


    /*
     * --------------------------------------------------------
     * 获取 Star
     * --------------------------------------------------------
     */

    const repositories =
        await getAllStarredRepositories();


    log(
        "当前 Star 仓库：" +
        repositories.length
    );


    /*
     * --------------------------------------------------------
     * 当前 Star 集合
     * --------------------------------------------------------
     */

    const currentStars = {};


    for (
        const repo of repositories
    ) {

        currentStars[
            repo.full_name
        ] = true;
    }


    /*
     * --------------------------------------------------------
     * 删除已经取消 Star 的历史项目
     * --------------------------------------------------------
     */

    for (
        const fullName in state.releases
    ) {

        if (
            !currentStars[fullName]
        ) {

            delete state.releases[
                fullName
            ];
        }
    }


    /*
     * --------------------------------------------------------
     * 检查 Release
     * --------------------------------------------------------
     */

    const newReleases = [];


    for (
        const repo of repositories
    ) {

        const fullName =
            repo.full_name;


        log(
            "检查：" +
            fullName
        );


        const release =
            await getLatestRelease(
                fullName
            );


        if (
            !shouldMonitorRelease(
                release
            )
        ) {

            await sleep(150);

            continue;
        }


        /*
         * GitHub Release ID
         */

        const releaseId =
            String(
                release.id
            );


        const previousId =
            state.releases[
                fullName
            ];


        /*
         * 第一次看到
         */

        if (
            typeof previousId ===
            "undefined"
        ) {

            state.releases[
                fullName
            ] = releaseId;


            log(
                "初始化：" +
                fullName +
                " -> " +
                getReleaseName(
                    release
                )
            );
        }


        /*
         * 新 Release
         */

        else if (
            previousId !==
            releaseId
        ) {

            newReleases.push(
                release
            );


            state.releases[
                fullName
            ] = releaseId;


            log(
                "发现新 Release：" +
                fullName +
                " -> " +
                getReleaseName(
                    release
                )
            );
        }


        await sleep(150);
    }


    /*
     * --------------------------------------------------------
     * 保存
     * --------------------------------------------------------
     */

    state.initialized = true;

    state.lastCheck =
        new Date().toISOString();


    saveState(state);


    /*
     * --------------------------------------------------------
     * 首次运行
     * --------------------------------------------------------
     */

    if (firstRun) {

        log(
            "首次运行完成，已建立 Release 基准"
        );


        if (
            CONFIG.NOTIFY_INITIALIZED
        ) {

            $notification.post(

                "GitHub Star 监控",

                "初始化完成",

                "已建立 " +
                repositories.length +
                " 个 Star 仓库的 Release 基准"
            );
        }


        return;
    }


    /*
     * --------------------------------------------------------
     * 没有新版本
     * --------------------------------------------------------
     */

    if (
        newReleases.length === 0
    ) {

        log(
            "没有发现新 Release"
        );

        return;
    }


    /*
     * --------------------------------------------------------
     * 推送新 Release
     * --------------------------------------------------------
     */

    log(
        "发现 " +
        newReleases.length +
        " 个新 Release"
    );


    const notifyList =
        newReleases.slice(
            0,
            CONFIG.MAX_NOTIFY_COUNT
        );


    for (
        const release of notifyList
    ) {

        notifyRelease(
            release
        );


        await sleep(500);
    }


    /*
     * 超过通知上限
     */

    notifySummary(
        newReleases
    );


    log(
        "========== 检查完成 =========="
    );
}


// ============================================================
// 执行
// ============================================================

(async () => {

    try {

        await main();

    } catch (error) {

        console.log(
            "[GitHub Star Loon] 执行失败：" +
            error
        );


        $notification.post(

            "GitHub Star 监控异常",

            "脚本执行失败",

            String(error)
        );
    }


    $done();

})();
