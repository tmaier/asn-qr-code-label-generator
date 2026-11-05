# Test fixtures

## `avery-designer-l4731.pdf`

Avery's own layout of the L4731 / L4731REV-25 sheet, used as the baseline
for `tests/lib/avery-l4731rev-25.mjs`.

To regenerate it, open the label designer at
<https://app.avery.co.uk/dpo8/appeu/target>, pick template L4731, keep the
default layout, give every label a red background, then export as PDF. The
background makes the designer draw each label as a clip path in the exact
die-cut shape, which `tests/lib/avery-designer-pdf.mjs` reads.

SHA-256: `cc221e64b657e099a4ee25180ea4199c3881d729dc7a00eda30c02f8a31aff3d`

Avery's Word template (`Avery_L4731_Word_Template.doc`, 2017) is not precise
enough to serve as a reference: its first column is 25.40 mm and the others
24.98 mm wide, with 2.95 mm gaps.
