type EventHandler = (data: any) => void | Promise<void>;

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  async emit(event: string, data: any): Promise<void> {
    const handlers = this.handlers.get(event);
    if (!handlers || handlers.length === 0) {
      return;
    }

    const promises = handlers.map(handler => {
      try {
        return Promise.resolve(handler(data));
      } catch (error) {
        console.error(`Event handler error for ${event}:`, error);
        return Promise.resolve();
      }
    });

    await Promise.allSettled(promises);
  }
}

export const eventBus = new EventBus();

export const EVENTS = {
  ACCOUNT_LOCKED: 'account:locked',
  NEW_DEVICE_LOGIN: 'auth:new-device-login',
  ADMIN_DISABLED_USER: 'admin:user-disabled',
  ADMIN_ENABLED_USER: 'admin:user-enabled',
  ADMIN_UNLOCKED_USER: 'admin:user-unlocked',
  ADMIN_FORCE_LOGOUT: 'admin:force-logout',
  ADMIN_CHANGED_ROLE: 'admin:changed-role',
  ASSET_RECORD_CREATED: 'asset:record-created',
  ASSET_RECORD_UPDATED: 'asset:record-updated',
  ASSET_RECORD_DELETED: 'asset:record-deleted',
  SYSTEM_NOTICE: 'system:notice',
} as const;
