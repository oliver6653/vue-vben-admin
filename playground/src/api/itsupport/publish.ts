import { baseRequestClient } from '#/api/request';

export namespace SystemDeptApi {
  export interface SystemDept {
    [key: string]: any;
    children?: SystemDept[];
    id: string;
    name: string;
    remark?: string;
    status: 0 | 1;
  }
}
const base_url = '/proxy/itsupport/';
/**
 * 获取欢迎语
 */
async function getHello(params?: string) {
  return baseRequestClient.post<string>(`${base_url}hello`, params);
}
async function publish(params?: string) {
  return baseRequestClient.post<string>(`${base_url}/publish`, params);
}

export { getHello, publish };
