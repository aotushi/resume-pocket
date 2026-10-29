import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("session_user_id_idx").on(table.userId)]);

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("account_user_id_idx").on(table.userId)]);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

/**
 * 分享链接（需求 7.x、10 节）：注册用户与游客共用，按存储前缀区分所有者。
 * 链接标识只存摘要用于校验，另存加密后的原文供所有者再次复制；expiresAt 为空表示永久有效。
 */
export const shareLink = sqliteTable("share_link", {
  id: text("id").primaryKey(),
  ownerPrefix: text("ownerPrefix").notNull(),
  resumeId: text("resumeId").notNull(),
  tokenHash: text("tokenHash").notNull().unique(),
  tokenEnc: text("tokenEnc").notNull(),
  target: text("target").notNull(),
  note: text("note").notNull().default(""),
  profile: text("profile").notNull().default("{}"),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  views: integer("views").notNull().default(0),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("share_link_owner_resume_idx").on(table.ownerPrefix, table.resumeId)]);
