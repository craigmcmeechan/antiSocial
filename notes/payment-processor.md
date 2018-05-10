### Charging for server access (preliminary integration)

Create an account on stripe

Set up a subscription plan called "monthly" in stripe

Set up stripe webhook to point to your server at /stripe/webhook

Get test API keys from stripe account

Add test keys to .env file


```
SUBSCRIPTION=true
STRIPE_PK=pk_test_xxx
STRIPE_SK=sk_test_xxx
STRIPE_SUBSCRIPTION_PLAN=monthly
```

restart service and load /testbench-subscription to test integration
