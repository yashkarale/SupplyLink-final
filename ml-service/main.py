from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Supply Link ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "supply-link-ml"}


@app.get("/insights")
def insights():
    return {
        "summary": {
            "forecast": "Demand trending up 18%",
            "inventoryHealth": "93% healthy",
            "customerPulse": "Repeat buyers strong",
        },
        "modules": [
            {
                "title": "Demand forecasting",
                "score": 92,
                "insight": "Best-selling items are likely to rise in the next 7 days.",
                "trend": "+18%",
            },
            {
                "title": "Inventory optimization",
                "score": 88,
                "insight": "Reorder 3 SKUs before Friday to avoid stockouts.",
                "trend": "+12%",
            },
            {
                "title": "Customer segmentation",
                "score": 90,
                "insight": "Returning buyers are contributing 62% of spend.",
                "trend": "+9%",
            },
        ],
        "connected": True,
    }
