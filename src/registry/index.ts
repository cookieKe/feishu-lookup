import type { CommandDef, ParamDef } from '../types';

/**
 * 命令注册中心。
 * 存储所有可用命令的定义，提供注册、查找和列表功能。
 *
 * 新增命令只需在 commands/ 目录下调用 registerCommand() 即可。
 */

const registry = new Map<string, CommandDef>();

export function registerCommand(name: string, def: CommandDef): void {
  if (registry.has(name)) {
    throw new Error(`Duplicate command registration: "${name}"`);
  }
  registry.set(name, def);
}

export function getCommand(name: string): CommandDef | undefined {
  return registry.get(name);
}

export interface CommandSummary {
  name: string;
  description: string;
  params: Record<string, ParamDef>;
}

export function listCommands(): CommandSummary[] {
  return Array.from(registry.entries()).map(([name, def]) => ({
    name,
    description: def.description,
    params: def.params,
  }));
}

// 命令模块需在使用前注册。由 src/index.ts 在启动时导入：
//   import './registry/commands/user';
//   import './registry/commands/calendar';
//   import './registry/commands/im';
//   import './registry/commands/docs';
