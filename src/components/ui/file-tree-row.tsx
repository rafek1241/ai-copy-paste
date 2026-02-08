import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  ChevronRight,
  FileArchive,
  FileCode2,
  FileImage,
  FileJson,
  FileMusic,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileType2,
  FileVideo,
  Folder,
  FolderOpen,
  HardDrive,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { TreeNode } from "@/types"
import { cn } from "@/lib/utils"

const fileTreeRowVariants = cva(
  "flex items-center pr-2 h-8 w-full min-w-0 border-b transition-colors cursor-pointer",
  {
    variants: {
      variant: {
        file: "border-border-dark/30 hover:bg-white/[0.04]",
        folder: "border-border-dark bg-[#161b22]/90 backdrop-blur-sm hover:bg-white/[0.02]",
      },
    },
    defaultVariants: {
      variant: "file",
    },
  }
)

export interface FileTreeRowContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof fileTreeRowVariants> {}

const FileTreeRowContainer = React.forwardRef<HTMLDivElement, FileTreeRowContainerProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(fileTreeRowVariants({ variant, className }))} {...props} />
  )
)
FileTreeRowContainer.displayName = "FileTreeRowContainer"

type HighlightSegment = {
  text: string
  isMatch: boolean
}

type FileTreeRowLabelProps = {
  segments: HighlightSegment[]
  className: string
  segmentKeyPrefix: string
}

type FileTreeRowPathProps = {
  path: string
  onClick: (e: React.MouseEvent) => void
  className?: string
}

type FileTreeRowCheckboxProps = {
  checked: boolean
  onChange: () => void
  onClick: (e: React.MouseEvent) => void
  checkboxRef: (el: HTMLInputElement | null) => void
  ariaLabel: string
}

type FileTreeRowIconProps = {
  Icon: LucideIcon
  className: string
}

type FileTreeRowIndentProps = {
  width: number
}

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation()
const rtlStyle: React.CSSProperties = { direction: "rtl", textAlign: "left" }

const fileIconMap: Record<string, { Icon: LucideIcon; className: string }> = {
  js: { Icon: FileCode2, className: "text-yellow-300" },
  jsx: { Icon: FileCode2, className: "text-cyan-300" },
  ts: { Icon: FileCode2, className: "text-blue-400" },
  tsx: { Icon: FileCode2, className: "text-blue-300" },
  mjs: { Icon: FileCode2, className: "text-yellow-300" },
  cjs: { Icon: FileCode2, className: "text-yellow-300" },
  json: { Icon: FileJson, className: "text-amber-300" },
  md: { Icon: FileText, className: "text-purple-300" },
  txt: { Icon: FileText, className: "text-white/60" },
  log: { Icon: FileText, className: "text-white/50" },
  html: { Icon: FileCode2, className: "text-orange-300" },
  htm: { Icon: FileCode2, className: "text-orange-300" },
  css: { Icon: FileType2, className: "text-sky-300" },
  scss: { Icon: FileType2, className: "text-pink-300" },
  less: { Icon: FileType2, className: "text-indigo-300" },
  yml: { Icon: FileJson, className: "text-amber-300" },
  yaml: { Icon: FileJson, className: "text-amber-300" },
  png: { Icon: FileImage, className: "text-emerald-300" },
  jpg: { Icon: FileImage, className: "text-emerald-300" },
  jpeg: { Icon: FileImage, className: "text-emerald-300" },
  gif: { Icon: FileImage, className: "text-emerald-300" },
  webp: { Icon: FileImage, className: "text-emerald-300" },
  svg: { Icon: FileImage, className: "text-emerald-300" },
  ico: { Icon: FileImage, className: "text-emerald-300" },
  mp3: { Icon: FileMusic, className: "text-fuchsia-300" },
  wav: { Icon: FileMusic, className: "text-fuchsia-300" },
  flac: { Icon: FileMusic, className: "text-fuchsia-300" },
  ogg: { Icon: FileMusic, className: "text-fuchsia-300" },
  mp4: { Icon: FileVideo, className: "text-rose-300" },
  mov: { Icon: FileVideo, className: "text-rose-300" },
  mkv: { Icon: FileVideo, className: "text-rose-300" },
  avi: { Icon: FileVideo, className: "text-rose-300" },
  webm: { Icon: FileVideo, className: "text-rose-300" },
  zip: { Icon: FileArchive, className: "text-yellow-400" },
  rar: { Icon: FileArchive, className: "text-yellow-400" },
  "7z": { Icon: FileArchive, className: "text-yellow-400" },
  tar: { Icon: FileArchive, className: "text-yellow-400" },
  gz: { Icon: FileArchive, className: "text-yellow-400" },
  bz2: { Icon: FileArchive, className: "text-yellow-400" },
  csv: { Icon: FileSpreadsheet, className: "text-green-400" },
  xls: { Icon: FileSpreadsheet, className: "text-green-400" },
  xlsx: { Icon: FileSpreadsheet, className: "text-green-400" },
  sh: { Icon: FileTerminal, className: "text-emerald-200" },
  bash: { Icon: FileTerminal, className: "text-emerald-200" },
  zsh: { Icon: FileTerminal, className: "text-emerald-200" },
  ps1: { Icon: FileTerminal, className: "text-emerald-200" },
  bat: { Icon: FileTerminal, className: "text-emerald-200" },
  cmd: { Icon: FileTerminal, className: "text-emerald-200" },
}

const defaultFileIcon = { Icon: FileText, className: "text-white/60" }

function getFileIconMeta(name: string) {
  const parts = name.toLowerCase().split(".")
  if (parts.length < 2) {
    return defaultFileIcon
  }
  const extension = parts.pop() || ""
  return fileIconMap[extension] || defaultFileIcon
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}

function getParentPath(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"))
  return lastSlash > 0 ? path.substring(0, lastSlash) : ""
}

function getHighlightSegments(text: string, query: string): HighlightSegment[] {
  if (!query.trim()) {
    return [{ text, isMatch: false }]
  }
  const normalizedText = text.toLowerCase()
  const normalizedQuery = query.toLowerCase()
  const matchIndex = normalizedText.indexOf(normalizedQuery)
  if (matchIndex === -1) {
    return [{ text, isMatch: false }]
  }
  const before = text.slice(0, matchIndex)
  const match = text.slice(matchIndex, matchIndex + query.length)
  const after = text.slice(matchIndex + query.length)
  return [
    { text: before, isMatch: false },
    { text: match, isMatch: true },
    { text: after, isMatch: false },
  ]
}

const FileTreeRowLabel = React.memo(function FileTreeRowLabel({
  segments,
  className,
  segmentKeyPrefix,
}: FileTreeRowLabelProps) {
  return (
    <span className={className} data-testid="tree-label">
      {segments.map((segment, index) => (
        <span
          key={`${segmentKeyPrefix}-${index}`}
          className={segment.isMatch ? "bg-white/20 text-white/90 rounded-[2px] px-0.5" : undefined}
        >
          {segment.text}
        </span>
      ))}
    </span>
  )
})

const FileTreeRowPath = React.memo(function FileTreeRowPath({
  path,
  onClick,
  className = "",
}: FileTreeRowPathProps) {
  return (
    <span
      className={cn(
        "text-white/20 text-[10px] pr-2 cursor-pointer hover:text-white/40 transition-colors select-none min-w-0 flex-1 truncate whitespace-nowrap",
        className
      )}
      style={rtlStyle}
      onClick={onClick}
      title="Click to copy path"
    >
      {path}
    </span>
  )
})

const FileTreeRowCheckbox = React.memo(function FileTreeRowCheckbox({
  checked,
  onChange,
  onClick,
  checkboxRef,
  ariaLabel,
}: FileTreeRowCheckboxProps) {
  return (
    <div className="w-5 flex justify-center mr-1" onClick={onClick}>
      <input
        ref={checkboxRef}
        type="checkbox"
        className="custom-checkbox appearance-none border border-border-dark checked:bg-primary checked:border-transparent relative after:content-[''] after:absolute after:inset-0 after:m-auto after:block after:w-1.5 after:h-1.5 after:rounded-[1px] checked:after:bg-white cursor-pointer size-3 rounded-sm bg-transparent text-primary focus:ring-1 focus:ring-primary/50 focus:ring-offset-0 select-none"
        checked={checked}
        onChange={onChange}
        aria-label={ariaLabel}
        data-testid="tree-checkbox"
      />
    </div>
  )
})

const FileTreeRowIcon = React.memo(function FileTreeRowIcon({ Icon, className }: FileTreeRowIconProps) {
  return (
    <span className="select-none flex-shrink-0" aria-hidden="true" data-testid="tree-icon">
      <Icon size={16} className={className} />
    </span>
  )
})

const FileTreeRowIndent = React.memo(function FileTreeRowIndent({ width }: FileTreeRowIndentProps) {
  return <div style={{ width }} className="flex-shrink-0" />
})

export interface FileTreeRowViewProps {
  node: TreeNode
  level: number
  offsetTop: number
  onRowClick: () => void
  onExpandClick: (e: React.MouseEvent) => void
  onCheckboxChange: () => void
  onPathClick: (e: React.MouseEvent) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  checkboxRef: (el: HTMLInputElement | null) => void
  showFullPath?: boolean
  disambiguationPath?: string
  highlightQuery?: string
}

const FileTreeRowView = React.memo(function FileTreeRowView({
  node,
  level,
  offsetTop,
  onRowClick,
  onExpandClick,
  onCheckboxChange,
  onPathClick,
  onKeyDown,
  checkboxRef,
  showFullPath = false,
  disambiguationPath,
  highlightQuery = "",
}: FileTreeRowViewProps) {
  const isFolder = node.is_dir
  const paddingLeft = React.useMemo(() => level * 12 + 8, [level])
  const isDriveRoot = isFolder && /^[A-Za-z]:$/.test(node.path)
  const parentPath = React.useMemo(() => getParentPath(node.path), [node.path])
  const displayPath = showFullPath ? node.path : parentPath
  const fileIconMeta = React.useMemo(() => getFileIconMeta(node.name), [node.name])
  const formattedSize = React.useMemo(() => formatFileSize(node.size || 0), [node.size])
  const rowStyle = React.useMemo<React.CSSProperties>(
    () => ({
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      transform: `translate3d(0, ${offsetTop}px, 0)`,
      willChange: "transform",
      contentVisibility: "auto",
    }),
    [offsetTop]
  )
  const highlightSegments = React.useMemo(
    () => getHighlightSegments(node.name, highlightQuery),
    [node.name, highlightQuery]
  )

  if (isFolder) {
    return (
      <FileTreeRowContainer
        variant="folder"
        style={rowStyle}
        onClick={onRowClick}
        data-testid="tree-node"
        data-node-type="folder"
        data-level={level}
        role="treeitem"
        aria-expanded={node.expanded}
        aria-selected={node.checked}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <FileTreeRowIndent width={paddingLeft} />

        <button
          type="button"
          className={cn(
            "p-0.5 -ml-0.5 mr-0.5 rounded hover:bg-white/10 transition-colors",
            "focus:outline-none focus:ring-1 focus:ring-primary/50"
          )}
          onClick={onExpandClick}
          aria-label={node.expanded ? "Collapse folder" : "Expand folder"}
          data-testid="expand-icon"
          data-expanded={node.expanded}
        >
          <ChevronRight
            size={16}
            className={cn(
              "text-white/40 transition-transform select-none",
              node.expanded && "rotate-90"
            )}
          />
        </button>

        <FileTreeRowCheckbox
          checked={node.checked}
          onChange={onCheckboxChange}
          onClick={stopPropagation}
          checkboxRef={checkboxRef}
          ariaLabel={`Select ${node.name}`}
        />

        <div
          className={cn("mr-2 select-none ", isDriveRoot ? "text-gray-400" : "text-yellow-600/70")}
          aria-hidden="true"
          data-testid="tree-icon"
        >
          {isDriveRoot ? <HardDrive size={16} /> : node.expanded ? <FolderOpen size={16} /> : <Folder size={16} />}
        </div>

        <FileTreeRowLabel
          segments={highlightSegments}
          className="text-xs font-medium select-none text-white/70 shrink-0 whitespace-nowrap"
          segmentKeyPrefix={`${node.path}-folder`}
        />

        <span className="text-[10px] select-none text-white/30 ml-2 shrink-0 whitespace-nowrap">
          ({node.child_count ?? node.childPaths?.length ?? 0} items)
        </span>

        {disambiguationPath ? (
          <span className="text-[10px] text-white/25 ml-2 truncate min-w-0 flex-1 select-none" title={disambiguationPath}>
            {disambiguationPath}
          </span>
        ) : (
          <FileTreeRowPath path={displayPath} onClick={onPathClick} className="ml-2" />
        )}
      </FileTreeRowContainer>
    )
  }

  const { Icon, className } = fileIconMeta

  return (
    <FileTreeRowContainer
      variant="file"
      style={rowStyle}
      onClick={onRowClick}
      data-testid="tree-node"
      data-node-type="file"
      data-level={level}
      role="treeitem"
      aria-selected={node.checked}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <FileTreeRowIndent width={paddingLeft} />

      <div className="mr-1 invisible select-none w-[14px] h-[14px]">
        <ChevronRight size={16} />
      </div>

      <FileTreeRowCheckbox
        checked={node.checked}
        onChange={onCheckboxChange}
        onClick={stopPropagation}
        checkboxRef={checkboxRef}
        ariaLabel={`Select ${node.name}`}
      />

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <FileTreeRowIcon Icon={Icon} className={cn("text-white/70", className)} />

        <FileTreeRowLabel
          segments={highlightSegments}
          className="text-white text-xs shrink-0 whitespace-nowrap"
          segmentKeyPrefix={`${node.path}-file`}
        />

        {disambiguationPath ? (
          <span className="text-[10px] text-white/25 truncate min-w-0 flex-1 select-none" title={disambiguationPath}>
            {disambiguationPath}
          </span>
        ) : (
          <FileTreeRowPath path={displayPath} onClick={onPathClick} />
        )}
      </div>

      <div className="px-2 select-none">
        <span className="text-[10px] font-mono text-white/30">{formattedSize}</span>
      </div>
    </FileTreeRowContainer>
  )
})

export { FileTreeRowContainer, fileTreeRowVariants, FileTreeRowView }
