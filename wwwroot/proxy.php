<?php
$url = $_GET['url'] ?? '';
if (!$url) {
    http_response_code(400);
    die('Missing url parameter');
}

if (!preg_match('#^https?://dl\.musicsbaran\.ir/#', $url)) {
    http_response_code(403);
    die('Invalid host');
}

$rangeHeader = $_SERVER['HTTP_RANGE'] ?? '';

$ch = curl_init($url);
if ($rangeHeader) {
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Range: $rangeHeader"]);
}
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
curl_setopt($ch, CURLOPT_TIMEOUT, 60);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$responseHeaders = [];
curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($curl, $header) use (&$responseHeaders) {
    $len = strlen($header);
    $header = trim($header);
    if (stripos($header, 'content-type:') === 0) {
        $responseHeaders['content-type'] = trim(substr($header, 13));
    }
    if (stripos($header, 'content-length:') === 0) {
        $responseHeaders['content-length'] = trim(substr($header, 15));
    }
    if (stripos($header, 'content-range:') === 0) {
        $responseHeaders['content-range'] = trim(substr($header, 14));
    }
    return $len;
});

$data = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 && $httpCode !== 206) {
    http_response_code($httpCode);
    die();
}

header('Content-Encoding: none');
header('Accept-Ranges: bytes');
header('Cache-Control: public, max-age=31536000, immutable');
header('Access-Control-Allow-Origin: *');

if (isset($responseHeaders['content-type'])) {
    header('Content-Type: ' . $responseHeaders['content-type']);
} else {
    header('Content-Type: audio/mpeg');
}

if ($httpCode == 206) {
    http_response_code(206);
    if (isset($responseHeaders['content-range'])) {
        header('Content-Range: ' . $responseHeaders['content-range']);
    }
    if (isset($responseHeaders['content-length'])) {
        header('Content-Length: ' . $responseHeaders['content-length']);
    }
}

echo $data;