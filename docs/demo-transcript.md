# Demo Transcript

This transcript can be reproduced from a clean checkout.

```bash
npm install
npm test
npm run validate:safe
npm run validate:unsafe
```

## Safe intent

The safe payment example is a verified merchant payment on an allowed chain, below value limits, with clear purpose and user confirmation.

Expected result:

```json
{
  "status": "allow",
  "severity": "low",
  "reasonCodes": []
}
```

## Review intent

The grant example is within max amount but above the human approval threshold and lacks user confirmation.

Expected result:

```json
{
  "status": "review",
  "reasonCodes": ["HUMAN_APPROVAL_REQUIRED"]
}
```

## Blocked intent

The unsafe swap example combines an unsupported chain, unknown recipient, value above max amount, high slippage, unclear purpose, and weak data confidence.

Expected result:

```json
{
  "status": "block",
  "severity": "critical"
}
```

The key demo moment is that IntentShield returns a safer suggested intent instead of simply failing.
