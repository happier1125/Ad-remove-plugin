/*
 * ============================================================
 * GitHub Star Release Monitor - Quantumult X
 * ============================================================
 *
 * 文件：
 * github_star_release_monitor_qx.js
 *
 * 功能：
 * 1. 自动获取 GitHub 当前账号全部 Star 仓库
 * 2. 自动分页，支持 100+ Star
 * 3. 检查每个仓库最新正式 Release
 * 4. 每小时运行一次
 * 5. 首次运行只建立版本基准，不通知
 * 6. 发现新 Release 后通过 QX 推送通知
 * 7. 点击通知直接打开 GitHub Release
 * 8. 默认忽略 Draft / Pre-release
 * 9. 自动保存历史版本
 *
 * Quantumult X 专用
 * ============================================================
 */

const CONFIG = {

    // ========================================================
    // GitHub Token
    // ========================================================
    //
    // 推荐使用 Fine-grained Personal Access Token
    //
    // 权限：
    // Account permissions
    //   Starring -> Read-only
    //
    // 如果全部监控公开仓库，也可以尝试留空。
    //
    GITHUB_TOKEN: "Your GitHub Token",


    // ========================================================
    // GitHub API
    // ========================================================

    API_BASE: "https://api.github.com",

    // GitHub 当前 API 版本
    API_VERSION: "2026-03-10",

    // GitHub 单页最大数量
    PER_PAGE: 100,


    // ========================================================
    // Release 设置
    // ========================================================

    // false = 只监控正式 Release
    // true  = 同时监控 Beta / RC / Alpha
    INCLUDE_PRERELEASE: false,

    // Draft 永远不会被 latest release API 返回给普通用户
    INCLUDE_DRAFT: false,


    // ========================================================
    // 通知设置
    // ========================================================

    ENABLE_NOTIFY: true,

    NOTIFY_TITLE: "GitHub Star 更新",

    // 一次最多推送多少条独立通知
    MAX_NOTIFY_COUNT: 10,

    // 如果一次更新超过 MAX_NOTIFY_COUNT
    // 是否额外发送一条汇总通知
    ENABLE_SUMMARY_NOTIFY: true,


    // ========================================================
    // 调试
    // ========================================================

    DEBUG: false,


    // ========================================================
    // 本地存储
    // ========================================================

    STORAGE_KEY:
        "github_star_release_monitor_qx_v1",

    // 第一次运行是否通知初始化完成
    // 推荐 false
    NOTIFY_INITIALIZED: false
};


// ============================================================
// 日志
// ============================================================

function log(message) {

    if (CONFIG.DEBUG) {

        console.log(
            "[GitHub Star QX] " +
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
// 本地持久化
// ============================================================

function loadState() {

    try {

        const value =
            $prefs.valueForKey(
                CONFIG.STORAGE_KEY
            );

        if (!value) {

            return null;
        }

        return JSON.parse(value);

    } catch (error) {

        log(
            "读取历史数据失败: " +
            error
        );

        return null;
    }
}


function saveState(state) {

    try {

        $prefs.setValueForKey(
            JSON.stringify(state),
            CONFIG.STORAGE_KEY
        );

        return true;

    } catch (error) {

        log(
            "保存历史数据失败: " +
            error
        );

        return false;
    }
}


// ============================================================
// GitHub HTTP 请求
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
                    "Quantumult-X-GitHub-Star-Release-Monitor"
            };


            // Token 非空才添加 Authorization
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


            $task.fetch({

                url: url,

                method: "GET",

                headers: headers

            }).then(response => {

                const status =
                    response.statusCode;


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
                            JSON.parse(
                                response.body
                            )
                        );

                    } catch (error) {

                        reject(
                            new Error(
                                "JSON 解析失败"
                            )
                        );
                    }

                } else {

                    reject(
                        new Error(
                            "HTTP " +
                            status +
                            ": " +
                            response.body
                        )
                    );
                }

            }).catch(error => {

                reject(error);

            });
        }
    );
}


// ============================================================
// 获取全部 Star 仓库
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


        let data;

        try {

            data =
                await githubRequest(url);

        } catch (error) {

            /*
             * GitHub API 权限/Token/网络错误
             * 直接抛给主程序处理
             */

            throw error;
        }


        if (
            !Array.isArray(data)
        ) {

            throw new Error(
                "Star API 返回数据异常"
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
         * 不满一页意味着已经到最后一页
         */

        if (
            data.length <
            CONFIG.PER_PAGE
        ) {

            break;
        }


        page++;


        /*
         * 防止异常情况下无限循环
         */

        if (page > 1000) {

            throw new Error(
                "Star 分页超过安全上限"
            );
        }


        /*
         * 稍微降低连续 API 请求速度
         */

        await sleep(200);
    }


    return repositories;
}


// ============================================================
// 获取某仓库最新 Release
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
         *
         * 这是正常情况，不通知
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
// Release 是否应该监控
// ============================================================

function shouldMonitorRelease(release) {

    if (!release) {

        return false;
    }


    // Draft
    if (
        release.draft === true &&
        !CONFIG.INCLUDE_DRAFT
    ) {

        return false;
    }


    // Pre-release
    if (
        release.prerelease === true &&
        !CONFIG.INCLUDE_PRERELEASE
    ) {

        return false;
    }


    return true;
}


// ============================================================
// 格式化发布时间
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
// 获取 Release 显示名称
// ============================================================

function getReleaseName(release) {

    if (
        release.tag_name
    ) {

        return release.tag_name;
    }


    if (
        release.name
    ) {

        return release.name;
    }


    return "新版本";
}


// ============================================================
// 单个 Release 通知
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
     * QX：
     *
     * $notify(
     *   title,
     *   subtitle,
     *   message,
     *   openURL
     * )
     */

    $notify(
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


    $notify(

        "GitHub Star 更新",

        "检测到多个新 Release",

        "本次共发现 " +
        releases.length +
        " 个新版本，已逐条通知前 " +
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

    log("========== 开始检查 ==========");


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
     * 获取 Star 仓库
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
     * 记录当前 Star 集合
     *
     * 取消 Star 后，下次自动从监控范围移除。
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
     *
     * 避免以后重新 Star 时被旧记录误判。
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
         * GitHub Release ID 是最可靠的唯一标识。
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
         * ----------------------------------------------------
         * 第一次看到：
         * 建立基准，不通知
         * ----------------------------------------------------
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
         * ----------------------------------------------------
         * Release ID 发生变化：
         * 新 Release
         * ----------------------------------------------------
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


        /*
         * 避免 API 请求过于密集
         */

        await sleep(150);
    }


    /*
     * --------------------------------------------------------
     * 更新时间
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

            $notify(

                "GitHub Star 监控",

                "初始化完成",

                "已建立 " +
                repositories.length +
                " 个 Star 仓库的 Release 基准。"
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
     * 新 Release 通知
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
     * 如果超过通知上限，额外提醒
     */

    notifySummary(
        newReleases
    );


    log("========== 检查完成 ==========");
}


// ============================================================
// 执行
// ============================================================

(async () => {

    try {

        await main();

    } catch (error) {

        console.log(
            "[GitHub Star QX] 执行失败：" +
            error
        );


        $notify(

            "GitHub Star 监控异常",

            "脚本执行失败",

            String(error)
        );
    }


    $done();

})();
