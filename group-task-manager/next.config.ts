import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 承認依頼への添付ファイル(上限5MB)を送るためのボディサイズ上限。
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
