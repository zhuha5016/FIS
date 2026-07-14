/* ======================================================================
   val.js - VAL Code 生成算法
   SHA-256/384/512 组合哈希，每分钟生成6位数
   与 Random 网站完全一致
   ====================================================================== */

window.FA = window.FA || {};

/**
 * 生成 VAL Code (按用户区分)
 * @param {number} timezoneOffset - 时区偏移（小时值：0, 8, -5, 9, 1）
 * @param {string} [username] - 用户名 (加入哈希种子, 同一分钟不同用户得到不同 VAL)
 * @returns {Promise<string>} 6位数字字符串
 * 种子格式: <utcTimestamp>SALTn<offset>|<username>  与 RDM 网站完全一致
 */
FA.generateVAL = async function(timezoneOffset, username) {
    try {
        var now = new Date();
        var utcTimestamp = Math.floor(now.getTime() / 60000);
        var user = username || '';

        var encoder = new TextEncoder();
        var hashes = await Promise.all([
            crypto.subtle.digest('SHA-256', encoder.encode(utcTimestamp + 'SALT1' + timezoneOffset + '|' + user)),
            crypto.subtle.digest('SHA-384', encoder.encode(utcTimestamp + 'SALT2' + timezoneOffset + '|' + user)),
            crypto.subtle.digest('SHA-512', encoder.encode(utcTimestamp + 'SALT3' + timezoneOffset + '|' + user))
        ]);

        var combined = new Uint8Array(
            [].concat(
                Array.from(new Uint8Array(hashes[0])),
                Array.from(new Uint8Array(hashes[1])),
                Array.from(new Uint8Array(hashes[2]))
            )
        );

        var finalHash = await crypto.subtle.digest('SHA-256', combined);
        var bytes = new Uint8Array(finalHash);

        var num = 0;
        for (var i = 0; i < 4; i++) {
            num = (num << 8) | bytes[i];
        }
        return (100000 + (Math.abs(num) % 900000)).toString();
    } catch (error) {
        console.error('VAL 生成错误:', error);
        return '123456';
    }
};

/* Random 网站也使用此文件，提供独立函数 */
if (typeof window.generateSecureRandom === 'undefined') {
    window.generateSecureRandom = FA.generateVAL;
}
