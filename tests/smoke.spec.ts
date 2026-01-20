import { expect, test } from '@playwright/test'

test('edit a cell and undo/redo changes', async ({ page }) => {
  await page.goto('/')

  const grid = page.locator('.grid-scroll-container')
  const selectionMeta = page.locator('.grid-selection-meta')
  await expect(grid).toBeVisible()

  const bounds = await grid.boundingBox()
  if (!bounds) {
    throw new Error('Grid container is not visible')
  }

  const cellWidth = 120
  const cellHeight = 32
  const padding = 10
  const editor = page.locator('.cell-editor')

  const cellPoint = (row: number, col: number) => ({
    x: bounds.x + padding + col * cellWidth,
    y: bounds.y + padding + row * cellHeight,
  })

  const setCell = async (row: number, col: number, value: string) => {
    const point = cellPoint(row, col)
    await page.mouse.dblclick(point.x, point.y)
    await expect(editor).toHaveCount(1)
    await editor.fill(value)
    const commitPoint = cellPoint(row + 1, col)
    await page.mouse.click(commitPoint.x, commitPoint.y)
    await expect(editor).toHaveCount(0)
  }

  const selectCell = async (row: number, col: number) => {
    const point = cellPoint(row, col)
    await page.mouse.click(point.x, point.y)
  }

  await setCell(0, 0, '123')
  await setCell(0, 1, '456')

  await selectCell(0, 0)
  await expect(selectionMeta).toHaveAttribute('data-selected-display', '123')
  await page.keyboard.press('ArrowRight')
  await expect(selectionMeta).toHaveAttribute('data-selected-display', '456')
  await page.keyboard.press('ArrowLeft')
  await expect(selectionMeta).toHaveAttribute('data-selected-display', '123')

  await selectCell(0, 1)
  const undoShortcut = process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z'
  await page.keyboard.press(undoShortcut)

  const b1 = cellPoint(0, 1)
  await page.mouse.dblclick(b1.x, b1.y)
  await expect(editor).toHaveValue('')
  const b1Commit = cellPoint(1, 1)
  await page.mouse.click(b1Commit.x, b1Commit.y)

  const redoShortcut = process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+Y'
  await page.keyboard.press(redoShortcut)
  await page.mouse.dblclick(b1.x, b1.y)
  await expect(editor).toHaveValue('456')
})

test('recalculate formula when precedent changes', async ({ page }) => {
  await page.goto('/')

  const grid = page.locator('.grid-scroll-container')
  const selectionMeta = page.locator('.grid-selection-meta')
  await expect(grid).toBeVisible()

  const bounds = await grid.boundingBox()
  if (!bounds) {
    throw new Error('Grid container is not visible')
  }

  const cellWidth = 120
  const cellHeight = 32
  const padding = 10
  const editor = page.locator('.cell-editor')

  const cellPoint = (row: number, col: number) => ({
    x: bounds.x + padding + col * cellWidth,
    y: bounds.y + padding + row * cellHeight,
  })

  const setCell = async (row: number, col: number, value: string) => {
    const point = cellPoint(row, col)
    await page.mouse.dblclick(point.x, point.y)
    await expect(editor).toHaveCount(1)
    await editor.fill(value)
    const commitPoint = cellPoint(row + 1, col)
    await page.mouse.click(commitPoint.x, commitPoint.y)
    await expect(editor).toHaveCount(0)
  }

  const selectCell = async (row: number, col: number) => {
    const point = cellPoint(row, col)
    await page.mouse.click(point.x, point.y)
  }

  await setCell(0, 0, '1')
  await setCell(0, 1, '2')
  await setCell(0, 2, '=A1+B1')

  await selectCell(0, 2)
  await expect(selectionMeta).toHaveAttribute('data-selected-display', '3')

  await setCell(0, 0, '5')
  await selectCell(0, 2)
  await expect(selectionMeta).toHaveAttribute('data-selected-display', '7')
})

test('paste a 3x3 TSV block into grid', async ({ page }) => {
  await page.goto('/')

  const grid = page.locator('.grid-scroll-container')
  await expect(grid).toBeVisible()

  const bounds = await grid.boundingBox()
  if (!bounds) {
    throw new Error('Grid container is not visible')
  }

  const cellWidth = 120
  const cellHeight = 32
  const padding = 10
  const editor = page.locator('.cell-editor')

  const cellPoint = (row: number, col: number) => ({
    x: bounds.x + padding + col * cellWidth,
    y: bounds.y + padding + row * cellHeight,
  })

  const tsv = 'A\tB\tC\n1\t2\t3\nx\ty\tz'
  const start = cellPoint(0, 0)
  await page.mouse.click(start.x, start.y)

  await page.evaluate((payload) => {
    const target = document.querySelector(payload.selector)
    if (!target) {
      throw new Error('Grid container is not available')
    }
    const data = new DataTransfer()
    data.setData('text/plain', payload.tsv)
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: data })
    target.dispatchEvent(event)
  }, {
    selector: '.grid-scroll-container',
    tsv,
  })

  const expectCell = async (row: number, col: number, value: string) => {
    const point = cellPoint(row, col)
    await page.mouse.dblclick(point.x, point.y)
    await expect(editor).toHaveValue(value)
    await page.mouse.click(point.x, point.y)
  }

  await expectCell(0, 0, 'A')
  await expectCell(0, 1, 'B')
  await expectCell(0, 2, 'C')
  await expectCell(1, 0, '1')
  await expectCell(1, 1, '2')
  await expectCell(1, 2, '3')
  await expectCell(2, 0, 'x')
  await expectCell(2, 1, 'y')
  await expectCell(2, 2, 'z')
})
