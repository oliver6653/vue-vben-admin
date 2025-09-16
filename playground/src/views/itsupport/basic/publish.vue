<script lang="ts" setup>
import type { UploadFile } from 'ant-design-vue';

import { h, toRaw } from 'vue';

import { Page } from '@vben/common-ui';

import { Card, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import { $t } from '#/locales';

const nextThursday = dayjs().add((4 - dayjs().day() + 7) % 7 || 7, 'day');

const [BaseForm] = useVbenForm({
  // 所有表单项共用，可单独在表单内覆盖
  commonConfig: {
    // 在label后显示一个冒号
    colon: true,
    // 所有表单项
    componentProps: {
      class: 'w-full',
    },
  },
  fieldMappingTime: [['rangePicker', ['startTime', 'endTime'], 'YYYY-MM-DD']],
  // 提交函数
  handleSubmit: onSubmit,
  handleValuesChange(_values, fieldsChanged) {
    message.info(`表单以下字段发生变化：${fieldsChanged.join('，')}`);
  },

  // 垂直布局，label和input在不同行，值为vertical
  // 水平布局，label和input在同一行
  layout: 'horizontal',
  schema: [
    {
      component: 'DatePicker',
      fieldName: 'datePicker',
      label: '发布版本',
      defaultValue: nextThursday,
    },
    {
      component: 'Switch',
      componentProps: {
        class: 'w-auto',
      },
      fieldName: 'switch',
      help: () =>
        ['分支合并帮助信息', '合并事务分支和时间分支', '谨慎使用！'].map((v) =>
          h('p', v),
        ),
      label: '分支合并',
    },
    {
      component: 'CheckboxGroup',
      componentProps: {
        name: 'cname',
        options: [
          {
            label: 'PRDBUG',
            value: '1',
          },
          {
            label: 'SEQ',
            value: '2',
          },
        ],
      },
      defaultValue: ['1'],
      fieldName: 'checkboxGroup',
      label: '分析范围',
    },
  ],
  // 大屏一行显示3个，中屏一行显示2个，小屏一行显示1个
  wrapperClass: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
});

function onSubmit(values: Record<string, any>) {
  message.success({
    content: `form values: ${JSON.stringify(values)}`,
  });
}
</script>

<template>
  <Page
    content-class="flex flex-col gap-4"
    description="自动化版本分析，涉及功能：1）当前版本计划状态 2）所有问题版本状态 3）自动合并代码及流转 。请仔细查看。"
    title="ITSupport - 发布版本"
  >
    <template #description>
      <div class="text-muted-foreground">
        <p>
          表单组件基础示例，请注意，该页面用到的参数代码会添加一些简单注释，方便理解，请仔细查看。
        </p>
      </div>
    </template>

    <Card title="计划分析">
      <BaseForm />
    </Card>
  </Page>
</template>
