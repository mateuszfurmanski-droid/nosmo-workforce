export const CONSTRUCTION_APP_REGISTRY = Object.freeze({
  "schema": "nosmo-construction-app-registry/v1",
  "registryVersion": "2026-08-27",
  "policy": {
    "discoveryMode": "controlled-identifiers-only",
    "installedInventoryMayLeaveDevice": false,
    "broadInventoryPermissionAllowed": false
  },
  "apps": [
    {
      "appDefinitionId": "whatsapp",
      "displayName": "WhatsApp",
      "category": "communication",
      "discoveryEnabled": true,
      "identifierStatus": "verified-controlled",
      "platforms": {
        "android": {
          "packageIds": [
            "com.whatsapp"
          ]
        }
      },
      "supportedConnectionLevels": [
        "OPEN"
      ],
      "defaultConnectionLevel": "OPEN",
      "identifierVerification": {
        "verifiedAt": "2026-08-27",
        "sourceType": "google-play-listing",
        "sourceUrl": "https://play.google.com/store/apps/details?id=com.whatsapp"
      }
    },
    {
      "appDefinitionId": "microsoft-teams",
      "displayName": "Microsoft Teams",
      "category": "communication",
      "discoveryEnabled": true,
      "identifierStatus": "verified-controlled",
      "platforms": {
        "android": {
          "packageIds": [
            "com.microsoft.teams"
          ]
        }
      },
      "supportedConnectionLevels": [
        "OPEN"
      ],
      "defaultConnectionLevel": "OPEN",
      "identifierVerification": {
        "verifiedAt": "2026-08-27",
        "sourceType": "google-play-listing",
        "sourceUrl": "https://play.google.com/store/apps/details?id=com.microsoft.teams"
      }
    },
    {
      "appDefinitionId": "google-drive",
      "displayName": "Google Drive",
      "category": "cloud-storage",
      "discoveryEnabled": true,
      "identifierStatus": "verified-controlled",
      "platforms": {
        "android": {
          "packageIds": [
            "com.google.android.apps.docs"
          ]
        }
      },
      "supportedConnectionLevels": [
        "OPEN"
      ],
      "defaultConnectionLevel": "OPEN",
      "identifierVerification": {
        "verifiedAt": "2026-08-27",
        "sourceType": "google-play-listing",
        "sourceUrl": "https://play.google.com/store/apps/details?id=com.google.android.apps.docs"
      }
    },
    {
      "appDefinitionId": "microsoft-onedrive",
      "displayName": "Microsoft OneDrive",
      "category": "cloud-storage",
      "discoveryEnabled": true,
      "identifierStatus": "verified-controlled",
      "platforms": {
        "android": {
          "packageIds": [
            "com.microsoft.skydrive"
          ]
        }
      },
      "supportedConnectionLevels": [
        "OPEN"
      ],
      "defaultConnectionLevel": "OPEN",
      "identifierVerification": {
        "verifiedAt": "2026-08-27",
        "sourceType": "google-play-listing",
        "sourceUrl": "https://play.google.com/store/apps/details?id=com.microsoft.skydrive"
      }
    },
    {
      "appDefinitionId": "dropbox",
      "displayName": "Dropbox",
      "category": "cloud-storage",
      "discoveryEnabled": true,
      "identifierStatus": "verified-controlled",
      "platforms": {
        "android": {
          "packageIds": [
            "com.dropbox.android"
          ]
        }
      },
      "supportedConnectionLevels": [
        "OPEN"
      ],
      "defaultConnectionLevel": "OPEN",
      "identifierVerification": {
        "verifiedAt": "2026-08-27",
        "sourceType": "google-play-listing",
        "sourceUrl": "https://play.google.com/store/apps/details?id=com.dropbox.android"
      }
    },
    {
      "appDefinitionId": "procore",
      "displayName": "Procore",
      "category": "project-management",
      "discoveryEnabled": false,
      "identifierStatus": "pending-verification",
      "platforms": {
        "android": {
          "packageIds": []
        }
      },
      "supportedConnectionLevels": [
        "OPEN",
        "DEEP_LINK",
        "CONNECTED"
      ],
      "defaultConnectionLevel": "OPEN"
    },
    {
      "appDefinitionId": "autodesk-construction-cloud",
      "displayName": "Autodesk Construction Cloud",
      "category": "bim-documentation",
      "discoveryEnabled": false,
      "identifierStatus": "pending-verification",
      "platforms": {
        "android": {
          "packageIds": []
        }
      },
      "supportedConnectionLevels": [
        "OPEN",
        "DEEP_LINK",
        "CONNECTED"
      ],
      "defaultConnectionLevel": "OPEN"
    },
    {
      "appDefinitionId": "fieldwire",
      "displayName": "Fieldwire",
      "category": "field-management",
      "discoveryEnabled": false,
      "identifierStatus": "pending-verification",
      "platforms": {
        "android": {
          "packageIds": []
        }
      },
      "supportedConnectionLevels": [
        "OPEN",
        "DEEP_LINK",
        "CONNECTED"
      ],
      "defaultConnectionLevel": "OPEN"
    },
    {
      "appDefinitionId": "planradar",
      "displayName": "PlanRadar",
      "category": "field-management",
      "discoveryEnabled": false,
      "identifierStatus": "pending-verification",
      "platforms": {
        "android": {
          "packageIds": []
        }
      },
      "supportedConnectionLevels": [
        "OPEN",
        "DEEP_LINK",
        "CONNECTED"
      ],
      "defaultConnectionLevel": "OPEN"
    },
    {
      "appDefinitionId": "dalux",
      "displayName": "Dalux",
      "category": "bim-documentation",
      "discoveryEnabled": false,
      "identifierStatus": "pending-verification",
      "platforms": {
        "android": {
          "packageIds": []
        }
      },
      "supportedConnectionLevels": [
        "OPEN",
        "DEEP_LINK",
        "CONNECTED"
      ],
      "defaultConnectionLevel": "OPEN"
    },
    {
      "appDefinitionId": "bluebeam",
      "displayName": "Bluebeam",
      "category": "drawings-documentation",
      "discoveryEnabled": false,
      "identifierStatus": "pending-verification",
      "platforms": {
        "android": {
          "packageIds": []
        }
      },
      "supportedConnectionLevels": [
        "OPEN",
        "DEEP_LINK",
        "CONNECTED"
      ],
      "defaultConnectionLevel": "OPEN"
    }
  ]
});

export default CONSTRUCTION_APP_REGISTRY;
