# CLI Usage

```bash
banksheet parse statement.pdf                          # auto-detect bank, output to stdout
banksheet parse statement.pdf --format csv -o out.csv  # export as CSV
banksheet parse statement.pdf --format excel           # export as Excel
banksheet parse statement.pdf --bank nubank            # specify bank explicitly
banksheet parse *.pdf --format excel -o combined.xlsx  # multiple files
banksheet list                                         # list available plugins
banksheet serve                                        # start local web UI
```
