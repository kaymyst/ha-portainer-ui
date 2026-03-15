const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class PortainerContainersCard extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      _config: { state: true },
      _containers: { state: true },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 16px 0;
        font-size: 1.2em;
        font-weight: 500;
      }
      .container-list {
        padding: 12px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .container-row {
        display: grid;
        grid-template-columns: 10px 1fr auto 54px 54px;
        align-items: center;
        gap: 0 8px;
        padding: 10px 12px;
        border-radius: 12px;
        background: var(--card-background-color, var(--ha-card-background, #fff));
        border: 1px solid var(--divider-color, #e0e0e0);
        cursor: pointer;
        transition: background 0.2s;
      }
      .container-row:hover {
        background: var(--secondary-background-color, #f5f5f5);
      }
      .state-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .state-dot.running {
        background-color: #4caf50;
      }
      .state-dot.exited {
        background-color: #f44336;
      }
      .state-dot.paused {
        background-color: #ff9800;
      }
      .state-dot.other {
        background-color: #9e9e9e;
      }
      .container-name {
        font-weight: 500;
        font-size: 0.95em;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .state-label {
        font-size: 0.8em;
        font-weight: 500;
        text-transform: capitalize;
      }
      .state-label.running {
        color: #4caf50;
      }
      .state-label.exited {
        color: #f44336;
      }
      .state-label.paused {
        color: #ff9800;
      }
      .state-label.other {
        color: #9e9e9e;
      }
      .stat {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.8em;
        color: var(--secondary-text-color, #727272);
        white-space: nowrap;
        justify-content: flex-end;
      }
      .stat ha-icon {
        --mdc-icon-size: 14px;
      }
      .empty {
        padding: 24px 16px;
        text-align: center;
        color: var(--secondary-text-color, #727272);
      }
    `;
  }

  setConfig(config) {
    this._config = {
      title: "Containers",
      ...config,
    };
  }

  getCardSize() {
    const count = this._containers ? this._containers.length : 5;
    return 1 + count;
  }

  async _loadRegistries() {
    if (this._registriesLoaded || !this.hass) return;
    this._registriesLoaded = true;

    try {
      const [devices, entities] = await Promise.all([
        this.hass.callWS({ type: "config/device_registry/list" }),
        this.hass.callWS({ type: "config/entity_registry/list" }),
      ]);

      this._devices = devices.filter(
        (d) =>
          d.manufacturer === "Portainer" &&
          d.model === "Container"
      );

      this._entityRegistry = entities;
      this._resolveContainers();
    } catch (e) {
      console.error("Portainer card: failed to load registries", e);
    }
  }

  _resolveContainers() {
    if (!this._devices || !this._entityRegistry || !this.hass) return;

    // Group non-disabled entities by device
    const entitiesByDevice = new Map();
    for (const ent of this._entityRegistry) {
      if (!ent.device_id) continue;
      if (ent.disabled_by) continue;
      if (!entitiesByDevice.has(ent.device_id)) {
        entitiesByDevice.set(ent.device_id, []);
      }
      entitiesByDevice.get(ent.device_id).push(ent);
    }

    const containers = [];

    for (const device of this._devices) {
      const deviceEntities = entitiesByDevice.get(device.id) || [];

      const findEntity = (key) => {
        const matches = deviceEntities.filter((e) =>
          e.unique_id?.endsWith(`_${key}`)
        );
        if (matches.length === 0) return null;
        // Prefer the entity that has a valid (non-unavailable) state
        const alive = matches.find((e) => {
          const s = this.hass.states[e.entity_id]?.state;
          return s && s !== "unavailable" && s !== "unknown";
        });
        return (alive || matches[0]).entity_id;
      };

      const stateEntityId = findEntity("container_state");
      const cpuEntityId = findEntity("cpu_usage_total");
      const memoryEntityId = findEntity("memory_usage");

      const stateObj = stateEntityId
        ? this.hass.states[stateEntityId]
        : null;

      // Skip devices with no state entity or unavailable/unknown state
      const stateValue = stateObj?.state;
      if (
        !stateValue ||
        stateValue === "unavailable" ||
        stateValue === "unknown"
      ) {
        continue;
      }

      const cpuObj = cpuEntityId
        ? this.hass.states[cpuEntityId]
        : null;
      const memoryObj = memoryEntityId
        ? this.hass.states[memoryEntityId]
        : null;

      const name =
        device.name_by_user || device.name || "Unknown";

      containers.push({
        name,
        state: stateValue,
        cpu: cpuObj?.state ?? "N/A",
        memory: memoryObj?.state ?? "N/A",
        memoryUnit: memoryObj?.attributes?.unit_of_measurement || "MB",
        stateEntityId,
      });
    }

    containers.sort((a, b) => a.name.localeCompare(b.name));
    this._containers = containers;
  }

  updated(changedProperties) {
    if (changedProperties.has("hass")) {
      this._loadRegistries();
      if (this._devices) {
        this._resolveContainers();
      }
    }
  }

  _getStateClass(state) {
    const s = state?.toLowerCase();
    if (s === "running") return "running";
    if (s === "exited") return "exited";
    if (s === "paused") return "paused";
    return "other";
  }

  _formatMemory(value, unit) {
    if (value === "N/A" || value === "unavailable" || value === "unknown")
      return "N/A";
    const num = parseFloat(value);
    if (isNaN(num)) return "N/A";
    if (unit === "B" || unit === "bytes") {
      return `${Math.round(num / (1024 * 1024))}M`;
    }
    if (unit === "KB" || unit === "KiB") {
      return `${Math.round(num / 1024)}M`;
    }
    if (unit === "GB" || unit === "GiB") {
      return `${(num * 1024).toFixed(0)}M`;
    }
    return `${Math.round(num)}M`;
  }

  _formatCpu(value) {
    if (value === "N/A" || value === "unavailable" || value === "unknown")
      return "N/A";
    const num = parseFloat(value);
    if (isNaN(num)) return "N/A";
    return `${num.toFixed(1)}%`;
  }

  _handleRowClick(container) {
    if (!container.stateEntityId) return;
    const event = new CustomEvent("hass-more-info", {
      composed: true,
      detail: { entityId: container.stateEntityId },
    });
    this.dispatchEvent(event);
  }

  render() {
    if (!this.hass || !this._config) {
      return html``;
    }

    const title = this._config.title;
    const containers = this._containers || [];

    return html`
      <ha-card>
        ${title ? html`<div class="card-header">${title}</div>` : ""}
        ${containers.length === 0
          ? html`<div class="empty">No containers found</div>`
          : html`
              <div class="container-list">
                ${containers.map(
                  (c) => html`
                    <div
                      class="container-row"
                      @click=${() => this._handleRowClick(c)}
                    >
                      <div
                        class="state-dot ${this._getStateClass(c.state)}"
                      ></div>
                      <div class="container-name">${c.name}</div>
                      <div
                        class="state-label ${this._getStateClass(c.state)}"
                      >
                        ${c.state}
                      </div>
                      <div class="stat">
                        <ha-icon icon="mdi:cpu-64-bit"></ha-icon>
                        ${this._formatCpu(c.cpu)}
                      </div>
                      <div class="stat">
                        <ha-icon icon="mdi:memory"></ha-icon>
                        ${this._formatMemory(c.memory, c.memoryUnit)}
                      </div>
                    </div>
                  `
                )}
              </div>
            `}
      </ha-card>
    `;
  }

  static getStubConfig() {
    return {
      title: "Containers",
    };
  }
}

customElements.define(
  "portainer-containers-card",
  PortainerContainersCard
);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "portainer-containers-card",
  name: "Portainer Containers",
  preview: true,
  description: "Displays Portainer containers with state, CPU, and memory usage",
});
