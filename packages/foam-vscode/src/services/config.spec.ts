import { CONFIG_KEY } from '../features/document-decorator';
import {
  getFoamVsCodeConfig,
  monitorFoamVsCodeConfig,
  updateFoamVsCodeConfig,
} from './config';

describe('configuration service', () => {
  it('should get the configuraiton option', async () => {
    await updateFoamVsCodeConfig(CONFIG_KEY, true);
    expect(getFoamVsCodeConfig(CONFIG_KEY)).toBeTruthy();
  });

  it('should monitor changes in configuration', async () => {
    await updateFoamVsCodeConfig(CONFIG_KEY, true);
    const getter = monitorFoamVsCodeConfig(CONFIG_KEY);
    expect(getter()).toBeTruthy();
    await updateFoamVsCodeConfig(CONFIG_KEY, false);
    expect(getter()).toBeFalsy();
    getter.dispose();
  });
});
