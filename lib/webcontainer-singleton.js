import { WebContainer } from '@webcontainer/api';

/**
 * Почему этого файла недостаточно решить через Zustand-стор напрямую:
 *
 * В React 18 (Strict Mode, dev-режим) эффекты в компонентах монтируются,
 * размонтируются и монтируются заново. Если внутри useEffect просто
 * проверять `if (!store.instance) boot()`, оба вызова эффекта могут
 * прочитать store.instance === null ДО того, как первый boot() успеет
 * записать результат обратно в стор — и .boot() вызовется дважды.
 * WebContainer.boot() бросает исключение при повторном вызове в рамках
 * одной вкладки браузера ("Only a single WebContainer instance can be booted").
 *
 * Решение: держим promise на уровне модуля (вне React), который
 * переживает ре-рендеры и повторные монтирования компонентов.
 */

let bootPromise = null;

export function getWebContainerInstance() {
  if (!bootPromise) {
    bootPromise = WebContainer.boot();
  }
  return bootPromise;
}
