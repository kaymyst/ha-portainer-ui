# Portainer Containers Card

A custom Home Assistant Lovelace card that displays Docker containers managed by the [Portainer integration](https://www.home-assistant.io/integrations/portainer/).

![Portainer Containers Card](portainer-customcard.png)

## Features

- Auto-discovers all Portainer containers via the HA device registry
- Displays container name, state, CPU usage, and memory usage
- Color-coded status indicators (green = running, red = exited, orange = paused)
- Click a container to open the Home Assistant more-info dialog
- Handles entity ID suffixes (`_2`, `_3`, etc.) gracefully

## Installation

### Manual

1. Copy `portainer-containers-card.js` to your Home Assistant `config/www/` directory
2. In your HA dashboard, go to **Settings → Dashboards → three-dot menu → Resources**
3. Add resource: `/local/portainer-containers-card.js` with type **JavaScript Module**

### HACS (Custom Repository)

1. In HACS, go to **Frontend → three-dot menu → Custom repositories**
2. Add this repository URL with category **Lovelace**
3. Install **Portainer Containers Card**
4. Restart Home Assistant

## Configuration

Add the card to your dashboard:

```yaml
type: custom:portainer-containers-card
title: Containers
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | `Containers` | Card title |

## Requirements

- Home Assistant with the [Portainer integration](https://www.home-assistant.io/integrations/portainer/) configured
