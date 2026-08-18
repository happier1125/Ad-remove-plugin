const url = $request.url;

let target = "";

try {
  const cleanUrl = url.split("#")[0];

  // t.me/+xxxxx
  let m = cleanUrl.match(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/\+([^/?]+)/i);
  if (m) {
    target = `tg://join?invite=${decodeURIComponent(m[1])}`;
  }

  // t.me/joinchat/xxxxx
  if (!target) {
    m = cleanUrl.match(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/joinchat\/([^/?]+)/i);
    if (m) {
      target = `tg://join?invite=${decodeURIComponent(m[1])}`;
    }
  }

  // t.me/c/123456/789
  if (!target) {
    m = cleanUrl.match(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/c\/(\d+)\/(\d+)/i);
    if (m) {
      target = `tg://privatepost?channel=${m[1]}&post=${m[2]}`;
    }
  }

  // t.me/username/123
  if (!target) {
    m = cleanUrl.match(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]+)\/(\d+)/i);
    if (m) {
      target = `tg://resolve?domain=${m[1]}&post=${m[2]}`;
    }
  }

  // t.me/username?start=xxxx
  if (!target) {
    m = cleanUrl.match(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]+)\?start=([^&]+)/i);
    if (m) {
      target = `tg://resolve?domain=${m[1]}&start=${m[2]}`;
    }
  }

  // t.me/username?startgroup=xxxx
  if (!target) {
    m = cleanUrl.match(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]+)\?startgroup=([^&]+)/i);
    if (m) {
      target = `tg://resolve?domain=${m[1]}&startgroup=${m[2]}`;
    }
  }

  // t.me/addstickers/xxxxx
  if (!target) {
    m = cleanUrl.match(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/addstickers\/([^/?]+)/i);
    if (m) {
      target = `tg://addstickers?set=${m[1]}`;
    }
  }

  // t.me/addemoji/xxxxx
  if (!target) {
    m = cleanUrl.match(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/addemoji\/([^/?]+)/i);
    if (m) {
      target = `tg://addemoji?set=${m[1]}`;
    }
  }

  // t.me/share/url
  if (!target && cleanUrl.includes("/share/url")) {
    const u = new URL(cleanUrl);
    const text = u.searchParams.get("text") || "";
    const shareUrl = u.searchParams.get("url") || "";

    target = `tg://msg_url?url=${encodeURIComponent(
      shareUrl
    )}&text=${encodeURIComponent(text)}`;
  }

  // 普通频道 / 群组 / 用户
  if (!target) {
    const path = cleanUrl
      .replace(/^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\//i, "")
      .split("?")[0]
      .replace(/\/$/, "");

    if (path.length > 0) {
      target = `tg://resolve?domain=${path}`;
    }
  }

  if (target) {
    $done({
      response: {
        status: 302,
        headers: {
          Location: target
        }
      }
    });
  } else {
    $done({});
  }
} catch (e) {
  console.log("TG_Turrit Error: " + e);
  $done({});
}
