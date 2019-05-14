export interface CommandParams {
  command: string;
  description: string;
  optionList: string[][];
  action: Function;
  version?: string;
}
