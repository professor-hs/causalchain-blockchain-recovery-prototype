import { test, expect } from '@playwright/test';

test.describe('CAUSALCHAIN E2E Patent Verification Suite', () => {
  test('1. Successful Bounded Recovery Scenario (Scenario H) & Navigation Verification', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('text=CAUSALCHAIN')).toBeVisible();

    // Default loads Scenario H -> ACCEPTED
    await expect(page.getByTestId('overview-protocol-decision')).toHaveText(
      'ACCEPTED'
    );

    // Navigate to Boundary Certification
    await page.getByTestId('nav-boundary').click();
    await expect(page.getByTestId('boundary-outcome-badge')).toHaveText(
      'CERTIFIED'
    );

    // Navigate to State Reconstruction
    await page.getByTestId('nav-reconstruction').click();
    await expect(page.getByTestId('reconstruction-status-badge')).toHaveText(
      'COMPLETED'
    );
  });

  test('2. Insufficient Evidence Scenario (Scenario B) Suspends Reconstruction', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('overview-scenario-SCENARIO_B').click();

    await expect(page.getByTestId('overview-protocol-decision')).toHaveText(
      'SUSPENDED'
    );

    await page.getByTestId('nav-completeness').click();
    await expect(page.getByTestId('completeness-status-badge')).toHaveText(
      'INSUFFICIENT'
    );
  });

  test('3. Tampered Certificate Scenario (Scenario G) Rejected by Independent Validators', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('overview-scenario-SCENARIO_G').click();

    await expect(page.getByTestId('overview-protocol-decision')).toHaveText(
      'REJECTED'
    );

    await page.getByTestId('nav-validators').click();
    await expect(page.getByTestId('validator-page-decision')).toContainText(
      'REJECTED'
    );
  });

  test('4. Version Conflict Scenario (Scenario C) Rejects Boundary & Recovery', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('overview-scenario-SCENARIO_C').click();

    await expect(page.getByTestId('overview-protocol-decision')).toHaveText(
      'REJECTED'
    );

    await page.getByTestId('nav-boundary').click();
    await expect(page.getByTestId('boundary-outcome-badge')).toHaveText(
      'REJECTED'
    );
  });
});
