// 版本号比较（简易 semver，仅主.次.修订）
// 模板版本固定为 x.y.z 形式；预发布标签首版不处理。

export function parseSemver(v: string): [number, number, number] {
  const m = (v || "")
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

/** remote 是否比 local 新 */
export function isNewer(remote: string, local: string): boolean {
  const a = parseSemver(remote);
  const b = parseSemver(local);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false; // 相等
}
