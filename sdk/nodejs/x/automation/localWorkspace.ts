// Copyright 2016-2020, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as fs from "fs";
import * as os from "os";
import * as upath from "upath";
import { CommandResult, runPulumiCmd } from "./cmd";
import { ConfigMap, ConfigValue } from "./config";
import { ProjectSettings } from "./projectSettings";
import { StackSettings } from "./stackSettings";
import { StackSummary, Workspace } from "./workspace";

export class LocalWorkspace implements Workspace {
    ready: Promise<any[]>;
    private workDir: string;
    private pulumiHome?: string;
    private program?: () => void;
    private envVars: { [key: string]: string };
    private secretsProvider?: string;
    constructor(opts?: LocalWorkspaceOpts) {
        let dir = "";
        let envs = {};

        if (opts) {
            const { workDir, pulumiHome, program, envVars, secretsProvider } = opts;
            if (workDir) {
                dir = workDir;
            }
            this.pulumiHome = pulumiHome;
            this.program = program;
            this.secretsProvider = secretsProvider;
            envs = { ...envVars };
        }

        if (!dir) {
            dir = fs.mkdtempSync(upath.joinSafe(os.tmpdir(), "automation-"));
        }
        this.workDir = dir;
        this.envVars = envs;

        const readinessPromises: Promise<any>[] = [];

        if (opts && opts.projectSettings) {
            readinessPromises.push(this.saveProjectSettings(opts.projectSettings));
        }
        if (opts && opts.stackSettings) {
            for (const [name, value] of Object.entries(opts.stackSettings)) {
                readinessPromises.push(this.saveStackSettings(value, name));
            }
        }

        this.ready = Promise.all(readinessPromises);
    }
    async projectSettings(): Promise<ProjectSettings> {
        for (const ext of settingsExtensions) {
            const isJSON = ext === ".json";
            const path = upath.joinSafe(this.workDir, `Pulumi${ext}`);
            if (!fs.existsSync(path)) { continue; }
            const contents = fs.readFileSync(path).toString();
            if (isJSON) {
                return Promise.resolve(ProjectSettings.fromJSON(JSON.parse(contents)));
            }
            return Promise.resolve(ProjectSettings.fromYAML(contents));
        }
        return Promise.reject(new Error(`failed to find project settings file in workdir: ${this.workDir}`));
    }
    async saveProjectSettings(settings: ProjectSettings): Promise<void> {
        let foundExt = ".yaml";
        for (const ext of settingsExtensions) {
            const testPath = upath.joinSafe(this.workDir, `Pulumi${ext}`);
            if (fs.existsSync(testPath)) {
                foundExt = ext;
                break;
            }
        }
        const path = upath.joinSafe(this.workDir, `Pulumi${foundExt}`);
        let contents;
        if (foundExt === ".json") {
            contents = JSON.stringify(settings, null, 4);
        }
        else {
            contents = settings.toYAML();
        }
        return Promise.resolve(fs.writeFileSync(path, contents));
    }
    async stackSettings(stackName: string): Promise<StackSettings> {
        const stackSettingsName = getStackSettingsName(stackName);
        for (const ext of settingsExtensions) {
            const isJSON = ext === ".json";
            const path = upath.joinSafe(this.workDir, `Pulumi.${stackSettingsName}${ext}`);
            if (!fs.existsSync(path)) { continue; }
            const contents = fs.readFileSync(path).toString();
            if (isJSON) {
                return Promise.resolve(StackSettings.fromJSON(JSON.parse(contents)));
            }
            return Promise.resolve(StackSettings.fromYAML(contents));
        }
        return Promise.reject(new Error(`failed to find stack settings file in workdir: ${this.workDir}`));
    }
    async saveStackSettings(settings: StackSettings, stackName: string): Promise<void> {
        const stackSettingsName = getStackSettingsName(stackName);
        let foundExt = ".yaml";
        for (const ext of settingsExtensions) {
            const testPath = upath.joinSafe(this.workDir, `Pulumi.${stackSettingsName}${ext}`);
            if (fs.existsSync(testPath)) {
                foundExt = ext;
                break;
            }
        }
        const path = upath.joinSafe(this.workDir, `Pulumi.${stackSettingsName}${foundExt}`);
        let contents;
        if (foundExt === ".json") {
            contents = JSON.stringify(settings, null, 4);
        }
        else {
            contents = settings.toYAML();
        }
        return Promise.resolve(fs.writeFileSync(path, contents));
    }
    async createStack(stackName: string): Promise<void> {
        const args = ["stack", "init", stackName];
        if (this.secretsProvider) {
            args.push("--secrets-provider", this.secretsProvider);
        }
        try {
            const result = await this.runPulumiCmd(args);
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }
    async selectStack(stackName: string): Promise<void> {
        try {
            const result = await this.runPulumiCmd(["stack", "select", stackName]);
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }
    async removeStack(stackName: string): Promise<void> {
        try {
            const result = await this.runPulumiCmd(["stack", "rm", "--yes", stackName]);
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }
    getConfig(stackName: string, key: string): Promise<ConfigValue> {
        // TODO
        return Promise.resolve(<any>{});
    }
    getAllConfig(stackName: string): Promise<ConfigMap> {
        // TODO
        return Promise.resolve(<any>{});
    }
    setConfig(stackName: string, key: string, value: ConfigValue): Promise<void> {
        // TODO
        return Promise.resolve(<any>{});
    }
    setAllConfig(stackName: string, config: ConfigMap): Promise<void> {
        // TODO
        return Promise.resolve(<any>{});
    }
    removeConfig(stackName: string, key: string): Promise<void> {
        // TODO
        return Promise.resolve(<any>{});
    }
    removeAllConfig(stackName: string, keys: string[]): Promise<void> {
        // TODO
        return Promise.resolve(<any>{});
    }
    refreshConfig(stackName: string): Promise<ConfigMap> {
        // TODO
        return Promise.resolve(<any>{});
    }
    getEnvVars(): { [key: string]: string } {
        return this.envVars;
    }
    setEnvVars(envs: { [key: string]: string }): void {
        this.envVars = { ...this.envVars, ...envs };
    }
    setEnvVar(key: string, value: string): void {
        this.envVars[key] = value;
    }
    unsetEnvVar(key: string): void {
        delete this.envVars[key];
    }
    getWorkDir(): string {
        return this.workDir;
    }
    getPulumiHome(): string | undefined {
        return this.pulumiHome;
    }

    whoAmI(): Promise<string> {
        // TODO
        return Promise.resolve(<any>{});
    }
    stack(): Promise<string> {
        // TODO
        return Promise.resolve(<any>{});
    }
    listStacks(): Promise<StackSummary[]> {
        // TODO
        return Promise.resolve(<any>{});
    }
    getProgram(): (() => void) | undefined {
        return this.program;
    }
    setProgram(program: () => void): void {
        this.program = program;
    }
    serializeArgsForOp(_: string): string[] {
        // LocalWorkspace does not take advantage of this extensibility point.
        return [];
    }
    postCommandCallback(_: string): void {
        // LocalWorkspace does not take advantage of this extensibility point.
        return;
    }
    private async runPulumiCmd(
        args: string[],
        onOutput?: (data: string) => void,
    ): Promise<CommandResult> {
        return runPulumiCmd(args, this.workDir, {});
    }
}

export type LocalWorkspaceOpts = {
    workDir?: string,
    pulumiHome?: string,
    program?: () => void,
    envVars?: { [key: string]: string },
    secretsProvider?: string,
    projectSettings?: ProjectSettings,
    stackSettings?: { [key: string]: StackSettings },
};

export const settingsExtensions = [".yaml", ".yml", ".json"];

const getStackSettingsName = (name: string): string => {
    const parts = name.split("/");
    if (parts.length < 1) {
        return name;
    }
    return parts[parts.length - 1];
};
