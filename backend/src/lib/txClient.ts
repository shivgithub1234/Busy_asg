import { PrismaClient } from "@prisma/client";
import { DefaultArgs } from "@prisma/client/runtime/library";

export type TxClient = Omit<
  PrismaClient<Record<string, never>, never, DefaultArgs>,
  "$connect" | "$disconnect" | "$extends" | "$on" | "$transaction" | "$use"
>;
