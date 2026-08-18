let body = $response.body;

// =========================
// AVPLE / HSEX LIVE Widget
// =========================

body = body.replace(
/<div class="root--26nWL bottomRight--h0VsQ slideAnimation--2ih2G"[\s\S]*?<\/div>/gi,
''
);

body = body.replace(
/<script[^>]*a\.pemsrv\.com\/popunder1000\.js[\s\S]*?<\/script>/gi,
''
);

body = body.replace(
/https:\/\/go\.bluetrafficstream\.com\/[^"']*/gi,
''
);

body = body.replace(
/https:\/\/go\.mavrtracktor\.com\/[^"']*/gi,
''
);

body = body.replace(
/<img[^>]*mavrtracktor[^>]*>/gi,
''
);

// =========================
// 634.tv Banner Ads
// =========================

body = body.replace(
/<div class="xyzxhfyv_b"[\s\S]*?<\/div>/gi,
''
);

body = body.replace(
/<div class="dCESIYmi"[\s\S]*?<\/div>/gi,
''
);

body = body.replace(
/<div[^>]*id="zbqWJKNh_[^"]*"[\s\S]*?<\/div>/gi,
''
);

body = body.replace(
/<script[^>]*nqtg15\.com[\s\S]*?<\/script>/gi,
''
);

body = body.replace(
/<script[^>]*7xu1ie\.com[\s\S]*?<\/script>/gi,
''
);

body = body.replace(
/https?:\/\/[^"']*eraserpen\.cc[^"']*/gi,
''
);

// =========================
// Common Popup
// =========================

body = body
.replace(/window\.open\([^\)]*\)/gi, '')
.replace(/document\.location/gi, '')
.replace(/popunder/gi, '')
.replace(/tabunder/gi, '');

$done({ body });
