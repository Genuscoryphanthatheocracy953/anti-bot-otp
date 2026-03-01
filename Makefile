.PHONY: up down logs test build-ios run-ios abuse legitimate verify clean env

env:
	@cp -n .env.example .env 2>/dev/null || true
	@echo ".env file ready"

up: env
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

test:
	docker compose exec backend npm test

build-ios:
	xcodebuild -project ios/OTPPoc/OTPPoc.xcodeproj \
		-scheme OTPPoc \
		-sdk iphonesimulator \
		-destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
		build

run-ios: build-ios
	xcrun simctl boot "iPhone 16 Pro" 2>/dev/null || true
	open -a Simulator

abuse:
	@echo "=== Running abuse simulations ==="
	cd scripts && npx tsx abuse-no-preflight.ts
	cd scripts && npx tsx abuse-rate-limit.ts
	cd scripts && npx tsx abuse-invalid-challenges.ts

legitimate:
	cd scripts && npx tsx legitimate-flow.ts

verify: up
	@echo "Waiting for backend..."
	@until curl -s http://localhost:3000/health > /dev/null 2>&1; do sleep 1; done
	@echo "Backend ready!"
	@make legitimate
	@make abuse

clean:
	docker compose down -v
	rm -rf backend/node_modules backend/dist web/node_modules web/.next
