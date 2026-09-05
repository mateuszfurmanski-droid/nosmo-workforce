# NOSMO Agency API parity map

Frontend calls: 23
Mapped: 9
Missing: 14

| Method | Frontend route | Status | Backend route |
|---|---|---|---|
| GET | `/account` | MAPPED | `/person-card/agency/account` |
| GET | `/activity?limit=50` | MAPPED | `/person-card/agency/activity` |
| GET | `/candidates?limit=200` | MAPPED | `/person-card/agency/candidates` |
| GET | `/health` | MISSING |  |
| GET | `/pipeline` | MISSING |  |
| GET | `/profile` | MAPPED | `/person-card/agency/profile` |
| GET | `/roster` | MAPPED | `/person-card/agency/v1/roster` |
| PATCH | `/applications/${encodeURIComponent(e.applicationId)}` | MAPPED | `/person-card/agency/v1/applications/:applicationId` |
| PATCH | `/placements/${encodeURIComponent(e.placementId)}` | MISSING |  |
| PATCH | `/profile` | MAPPED | `/person-card/agency/profile` |
| PATCH | `/requests/${encodeURIComponent(e.requestId)}` | MISSING |  |
| PATCH | `/roster/${encodeURIComponent(e.rosterWorkerId)}` | MISSING |  |
| POST | `/account` | MAPPED | `/person-card/agency/account` |
| POST | `/applications/${encodeURIComponent(a.applicationId)}/events` | MISSING |  |
| POST | `/applications/${encodeURIComponent(e.applicationId)}/events` | MISSING |  |
| POST | `/applications/${encodeURIComponent(i.applicationId)}/events` | MISSING |  |
| POST | `/applications/${encodeURIComponent(Ke.applicationId)}/placement` | MISSING |  |
| POST | `/invites` | MISSING |  |
| POST | `/nexus/query` | MISSING |  |
| POST | `/requests` | MAPPED | `/person-card/agency/v1/requests` |
| POST | `/requests/${encodeURIComponent(t.requestId)}/applications` | MISSING |  |
| POST | `/roster/${encodeURIComponent(e.rosterWorkerId)}/events` | MISSING |  |
| POST | `/roster/import` | MISSING |  |
