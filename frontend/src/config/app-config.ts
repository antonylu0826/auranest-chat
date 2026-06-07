import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

// ⚠️  Fork 後請修改以下所有欄位
export const APP_CONFIG = {
  name: "AuraNest Chat",
  version: packageJson.version,
  copyright: `© ${currentYear}, AuraNest Chat.`,
  meta: {
    title: "AuraNest Chat",
    description: "Team messaging for AuraNest.",
  },
};
