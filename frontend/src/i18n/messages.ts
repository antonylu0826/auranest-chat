import type { Locale } from "./config";
import en from "../../messages/en.json";
import zhTW from "../../messages/zh-TW.json";

type Messages = { [key: string]: string | Messages };

export const allMessages: Record<Locale, Messages> = {
  "zh-TW": zhTW as Messages,
  en: en as Messages,
};
