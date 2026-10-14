import { describe,expect,it } from "vitest";
import { assertDevelopmentDatabase,postgresConnectionConfig,type SqlExecutor } from "@padlownia/database";

describe("verified database connection boundaries", () => {
  const connection = "postgresql://padlownia_web:synthetic%40password@db.abcdefghijklmnopqrst.supabase.co:5432/postgres";
  it("maps explicit URL fields and always verifies TLS without passing a connectionString to pg", () => {
    const config = postgresConnectionConfig(`${connection}?sslmode=verify-full`);
    expect(config).toMatchObject({ host: "db.abcdefghijklmnopqrst.supabase.co",port: 5432,user: "padlownia_web",password: "synthetic@password",database: "postgres",ssl: { rejectUnauthorized: true } });
    expect(config).not.toHaveProperty("connectionString");
  });
  it.each([
    "?host=evil.test","?user=postgres","?password=injected","?port=6543","?dbname=other",
    "?ssl=false","?sslmode=disable","?sslmode=require","?sslmode=no-verify","?sslrootcert=untrusted",
    "?sslmode=verify-full&sslmode=verify-full","?options=-c%20search_path=public","#fragment",
  ])("rejects connection/SSL override %s", (suffix) => {
    expect(() => postgresConnectionConfig(connection+suffix)).toThrow(/^INVALID_DATABASE_CONNECTION_CONFIG$/);
  });
  it.each(["http://user:password@example.test/database","postgres://user@example.test/database","not-a-url","postgres://user:password@example.test/","postgres://user:password@example.test/a%2Fb"])("rejects malformed or incomplete connection strings", (url) => {
    expect(() => postgresConnectionConfig(url)).toThrow(/^INVALID_DATABASE_CONNECTION_CONFIG$/);
  });
  it("fails closed for mismatching/absent marker or unavailable metadata without driver details", async () => {
    const db = (rows: unknown[]): SqlExecutor => ({ query: async <T>() => ({ rows: rows as T[] }),transaction: async () => { throw new Error("unused"); } });
    await expect(assertDevelopmentDatabase(db([{ environment: "development",project_ref: "abcdefghijklmnopqrst" }]),"abcdefghijklmnopqrst")).resolves.toBeUndefined();
    await expect(assertDevelopmentDatabase(db([]),"abcdefghijklmnopqrst")).rejects.toThrow("DATABASE_IDENTITY_MISMATCH");
    await expect(assertDevelopmentDatabase(db([{ environment: "production",project_ref: "abcdefghijklmnopqrst" }]),"abcdefghijklmnopqrst")).rejects.toThrow("DATABASE_IDENTITY_MISMATCH");
    await expect(assertDevelopmentDatabase(db([{ environment: "development",project_ref: "differentprojectrefxx" }]),"abcdefghijklmnopqrst")).rejects.toThrow("DATABASE_IDENTITY_MISMATCH");
    const unavailable = { ...db([]),query: async () => { throw new Error("postgres://user:secret@host"); } };
    await expect(assertDevelopmentDatabase(unavailable,"abcdefghijklmnopqrst")).rejects.toThrow(/^DATABASE_IDENTITY_UNAVAILABLE$/);
  });
});
